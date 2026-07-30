<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

// Returns reports in one payload. Pagination is handled client-side.
//
// - body {"scope":"mine"}: the caller's OWN submitted reports, any status,
//   regardless of role — this is what "My Reports"/feedback (user-home)
//   uses, since anyone can submit a ticket via Report Issue and should be
//   able to track and leave feedback on it, not just role="reporter".
// - empty body, reporter: same as scope=mine (kept for back-compat).
// - empty body, admin/supervisor: the pending approval queue.
// - empty body, technician: not this endpoint — the pending-approval queue
//   is an admin/supervisor decision, not something a technician acts on.
//   Technicians work off get_work_orders.php once a report is approved.

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$user = requireLogin();

$body  = json_decode(file_get_contents('php://input'), true) ?: [];
$scope = isset($body['scope']) ? (string) $body['scope'] : '';

if ($scope !== 'mine' && $user['role'] !== 'reporter' && !in_array($user['role'], ['admin', 'supervisor'], true)) {
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
            d.name   AS department,
            r.priority,
            r.status,
            r.submitted_at,
            u_to.name AS assigned_to,
            rf.rating  AS feedback_rating,
            rf.comment AS feedback_comment,
            GROUP_CONCAT(DISTINCT rp.url ORDER BY rp.id SEPARATOR \',\') AS photo_urls
        FROM reports r
        JOIN categories c ON c.id = r.category_id
        JOIN locations  l ON l.id = r.location_id
        LEFT JOIN departments d ON d.id = l.department_id
        LEFT JOIN work_orders wo ON wo.id = (
            SELECT wo2.id FROM work_orders wo2
            WHERE wo2.report_id = r.id AND wo2.status != "cancelled"
            ORDER BY wo2.id DESC
            LIMIT 1
        )
        LEFT JOIN users u_to ON u_to.id = wo.assigned_to
        LEFT JOIN report_photos rp ON rp.report_id = r.id
        LEFT JOIN report_feedback rf ON rf.report_id = r.id
    ';
    $groupBy = ' GROUP BY r.id, r.reference, r.issue, r.description, c.name, l.name, d.name, r.priority, r.status, r.submitted_at, u_to.name, rf.rating, rf.comment';

    if ($scope === 'mine' || $user['role'] === 'reporter') {
        $stmt = $db->prepare($baseSql . ' WHERE r.submitted_by = :submitted_by' . $groupBy . ' ORDER BY r.submitted_at DESC');
        $stmt->execute([':submitted_by' => $user['id']]);
    } elseif ($user['role'] === 'supervisor') {
        // Departmental scoping: a supervisor only sees tickets whose
        // location is confirmed to be in their own department. A ticket
        // whose location has no department assigned yet, or a supervisor
        // with no department of their own, never matches — admin remains
        // responsible for those until an admin assigns them, rather than
        // defaulting to "show everything" and leaking cross-department data.
        $stmt = $db->prepare($baseSql . ' WHERE r.status = "pending" AND l.department_id = :department_id' . $groupBy . ' ORDER BY r.submitted_at DESC');
        $stmt->execute([':department_id' => $user['department_id'] ?? -1]);
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
