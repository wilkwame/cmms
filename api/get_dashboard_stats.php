<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

requireRole(['admin', 'supervisor']);

try {
    $db = connectToDatabase();

    // Overall KPI counts across all work orders
    $kpiStmt = $db->query("
        SELECT
            COUNT(*)                                                      AS total,
            SUM(status = 'pending')                                       AS pending,
            SUM(status = 'in_progress')                                   AS in_progress,
            SUM(status = 'completed')                                     AS completed,
            SUM(status = 'overdue')                                       AS overdue
        FROM work_orders
    ");
    $kpi = $kpiStmt->fetch();

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
