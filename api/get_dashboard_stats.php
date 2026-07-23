<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

// Technicians land on this same shared dashboard (see app.js's loadHomePage)
// and see the same global Work Orders table/Overview chart as admin and
// supervisor — restricting this endpoint to admin/supervisor meant every
// technician's request came back 403, silently falling back to all-zero
// placeholder stats on the frontend regardless of real data.
requireRole(['admin', 'supervisor', 'technician']);

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

    // A work order that exists but hasn't been started yet ("pending") used
    // to fall through uncounted here — not a report-level "pending" (its
    // report already flipped to "approved" the moment the work order was
    // created), and not in_progress/completed/overdue either. That left
    // Pending+In Progress+Completed+Overdue not summing to Total. Folded in
    // below, along with pending_review (submitted by a technician, awaiting
    // admin approval) counted as still "in progress" rather than a state
    // with no KPI card of its own.
    $woStmt = $db->query("
        SELECT
            SUM(status = 'pending')                          AS pending,
            SUM(status IN ('in_progress', 'pending_review'))  AS in_progress,
            SUM(status = 'completed')                        AS completed,
            SUM(status = 'overdue')                          AS overdue
        FROM work_orders
    ");
    $woKpi = $woStmt->fetch();

    $kpi = [
        'total'       => $reportKpi['total'],
        'pending'     => (int) $reportKpi['pending'] + (int) $woKpi['pending'],
        'in_progress' => $woKpi['in_progress'],
        'completed'   => $woKpi['completed'],
        'overdue'     => $woKpi['overdue'],
    ];

    // Last 90 days breakdown for the overview chart — same pending_review
    // folding as above, for the same reason.
    $chartStmt = $db->query("
        SELECT
            SUM(status = 'completed')                        AS completed,
            SUM(status IN ('in_progress', 'pending_review'))  AS in_progress,
            SUM(status = 'overdue')                           AS overdue
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
