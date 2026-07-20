<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

requireRole(['admin', 'supervisor']);

try {
    $db = connectToDatabase();

    // "Total"/"Pending" reflect reports (a report can sit pending with no
    // work order yet, e.g. if auto-assignment found no matching staff) —
    // pulling these from work_orders alone made them read 0 even when
    // reports existed. "In Progress"/"Completed"/"Overdue" only apply once
    // a work order exists, so those still come from work_orders.
    $reportStmt = $db->query("
        SELECT
            COUNT(*)                AS total,
            SUM(status = 'pending') AS pending
        FROM reports
    ");
    $reportKpi = $reportStmt->fetch();

    $woStmt = $db->query("
        SELECT
            SUM(status = 'in_progress') AS in_progress,
            SUM(status = 'completed')   AS completed,
            SUM(status = 'overdue')     AS overdue
        FROM work_orders
    ");
    $woKpi = $woStmt->fetch();

    $kpi = [
        'total'       => $reportKpi['total'],
        'pending'     => $reportKpi['pending'],
        'in_progress' => $woKpi['in_progress'],
        'completed'   => $woKpi['completed'],
        'overdue'     => $woKpi['overdue'],
    ];

    // Last 30 days breakdown for the overview chart
    $chartStmt = $db->query("
        SELECT
            SUM(status = 'completed')   AS completed,
            SUM(status = 'in_progress') AS in_progress,
            SUM(status = 'overdue')     AS overdue
        FROM work_orders
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
    ");
    $chart = $chartStmt->fetch();

    sendJson(true, 200, [
        'kpi'   => [
            'total'       => (int) $kpi['total'],
            'pending'     => (int) $kpi['pending'],
            'in_progress' => (int) $kpi['in_progress'],
            'completed'   => (int) $kpi['completed'],
            'overdue'     => (int) $kpi['overdue'],
        ],
        'chart' => [
            'completed'   => (int) $chart['completed'],
            'in_progress' => (int) $chart['in_progress'],
            'overdue'     => (int) $chart['overdue'],
        ],
    ]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
