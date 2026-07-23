<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

// Technicians land on this same shared dashboard (see app.js's loadHomePage)
// and see the same Work Orders table/Overview chart as admin and supervisor
// — restricting this endpoint to admin/supervisor meant every technician's
// request came back 403, silently falling back to all-zero placeholder
// stats on the frontend regardless of real data.
$user = requireRole(['admin', 'supervisor', 'technician']);

try {
    $db = connectToDatabase();

    // A technician's numbers are their own task history, not the whole
    // system's — get_work_orders.php already scopes the list itself the
    // same way; this endpoint hadn't been scoped to match, so "My Recent
    // Work" could say nothing was assigned while the KPI cards above it
    // still showed everyone else's totals.
    $isTechnician = $user['role'] === 'technician';

    if ($isTechnician) {
        $reportKpi = ['total' => 0, 'pending' => 0];
    } else {
        // "Total"/"Pending" reflect reports (a report can sit pending with
        // no work order yet, e.g. if auto-assignment found no matching
        // staff) — pulling these from work_orders alone made them read 0
        // even when reports existed. "In Progress"/"Completed"/"Overdue"
        // only apply once a work order exists, so those still come from
        // work_orders.
        $reportStmt = $db->query("
            SELECT
                COUNT(*)                AS total,
                SUM(status = 'pending') AS pending
            FROM reports
        ");
        $reportKpi = $reportStmt->fetch();
    }

    // A work order that exists but hasn't been started yet ("pending") used
    // to fall through uncounted here — not a report-level "pending" (its
    // report already flipped to "approved" the moment the work order was
    // created), and not in_progress/completed/overdue either. That left
    // Pending+In Progress+Completed+Overdue not summing to Total. Folded in
    // below, along with pending_review (submitted by a technician, awaiting
    // admin approval) counted as still "in progress" rather than a state
    // with no KPI card of its own.
    $woWhere = $isTechnician ? 'WHERE assigned_to = :user_id' : '';
    $woParams = $isTechnician ? [':user_id' => $user['id']] : [];

    $woStmt = $db->prepare("
        SELECT
            COUNT(*)                                         AS total,
            SUM(status = 'pending')                          AS pending,
            SUM(status IN ('in_progress', 'pending_review'))  AS in_progress,
            SUM(status = 'completed')                        AS completed,
            SUM(status = 'overdue')                          AS overdue
        FROM work_orders
        $woWhere
    ");
    $woStmt->execute($woParams);
    $woKpi = $woStmt->fetch();

    $kpi = [
        // For a technician, "Total" is their own task count (work_orders),
        // not the system's report count.
        'total'       => $isTechnician ? $woKpi['total'] : $reportKpi['total'],
        'pending'     => (int) $reportKpi['pending'] + (int) $woKpi['pending'],
        'in_progress' => $woKpi['in_progress'],
        'completed'   => $woKpi['completed'],
        'overdue'     => $woKpi['overdue'],
    ];

    // Last 90 days breakdown for the overview chart — same pending_review
    // folding and per-technician scoping as above.
    $chartWhere = $isTechnician
        ? 'WHERE assigned_to = :user_id AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)'
        : 'WHERE created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)';
    $chartStmt = $db->prepare("
        SELECT
            SUM(status = 'completed')                        AS completed,
            SUM(status IN ('in_progress', 'pending_review'))  AS in_progress,
            SUM(status = 'overdue')                           AS overdue
        FROM work_orders
        $chartWhere
    ");
    $chartStmt->execute($woParams);
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
