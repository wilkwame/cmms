<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

// Returns reports in one payload. Pagination is handled client-side.
// POST body is intentionally empty: no parameters needed.
//
// - reporter: all of their own reports, any status (for "My Reports").
// - admin/supervisor/technician: the pending approval queue (existing behaviour).

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$user = requireLogin();

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
            u_to.name AS assigned_to
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
    ';

    if ($user['role'] === 'reporter') {
        $stmt = $db->prepare($baseSql . ' WHERE r.submitted_by = :submitted_by ORDER BY r.submitted_at DESC');
        $stmt->execute([':submitted_by' => $user['id']]);
    } else {
        $stmt = $db->prepare($baseSql . ' WHERE r.status = "pending" ORDER BY r.submitted_at DESC');
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
