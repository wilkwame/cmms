<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

// Returns reports in one payload. Pagination is handled client-side.
// POST body is intentionally empty: no parameters needed.
//
// - reporter: all of their own reports, any status (for "My Reports").
// - admin/supervisor: the pending approval queue.
// - technician: not this endpoint — the pending-approval queue is an
//   admin/supervisor decision, not something a technician sees or acts on.
//   Technicians work off get_work_orders.php once a report is approved.

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$user = requireLogin();

if ($user['role'] !== 'reporter' && !in_array($user['role'], ['admin', 'supervisor'], true)) {
    sendJson(false, 403, 'You do not have permission to view the reports queue');
}

try {
    $db = connectToDatabase();

    $baseSql = '
        SELECT
            r.id,
            r.reference,
            r.issue,
            r.description,
            c.name   AS category,
            l.name   AS location,
            r.priority,
            r.status,
            r.submitted_at,
            u_to.name AS assigned_to,
            GROUP_CONCAT(DISTINCT rp.url ORDER BY rp.id SEPARATOR \',\') AS photo_urls
        FROM reports r
        JOIN categories c ON c.id = r.category_id
        JOIN locations  l ON l.id = r.location_id
        LEFT JOIN work_orders wo ON wo.id = (
            SELECT wo2.id FROM work_orders wo2
            WHERE wo2.report_id = r.id AND wo2.status != "cancelled"
            ORDER BY wo2.id DESC
            LIMIT 1
        )
        LEFT JOIN users u_to ON u_to.id = wo.assigned_to
        LEFT JOIN report_photos rp ON rp.report_id = r.id
    ';
    $groupBy = ' GROUP BY r.id, r.reference, r.issue, r.description, c.name, l.name, r.priority, r.status, r.submitted_at, u_to.name';

    if ($user['role'] === 'reporter') {
        $stmt = $db->prepare($baseSql . ' WHERE r.submitted_by = :submitted_by' . $groupBy . ' ORDER BY r.submitted_at DESC');
        $stmt->execute([':submitted_by' => $user['id']]);
    } else {
        $stmt = $db->prepare($baseSql . ' WHERE r.status = "pending"' . $groupBy . ' ORDER BY r.submitted_at DESC');
        $stmt->execute();
    }

    $reports = $stmt->fetchAll();

    sendJson(true, 200, [
        'reports' => $reports,
        'total'   => count($reports),
    ]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
