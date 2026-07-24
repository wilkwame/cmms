<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

// Soft-delete: staff are deactivated (is_active = 0) rather than hard-deleted,
// since users.id is referenced by reports.submitted_by, work_orders.assigned_to,
// and work_order_activity.actor_id — a hard delete would either violate those
// foreign keys or silently orphan history. Deactivated staff are excluded from
// auto-assignment and shown as "Inactive" in the staff list.
//
// Expected POST body: { "id": int }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$currentUser = requireRole(['admin']);

$body = json_decode(file_get_contents('php://input'), true);
$id   = (int) ($body['id'] ?? 0);

if ($id <= 0) {
    sendJson(false, 400, 'Staff id is required');
}

try {
    $db = connectToDatabase();

    $nameStmt = $db->prepare('SELECT name FROM users WHERE id = :id');
    $nameStmt->execute([':id' => $id]);
    $targetName = $nameStmt->fetchColumn();

    $stmt = $db->prepare('UPDATE staff_profiles SET is_active = 0 WHERE user_id = :id');
    $stmt->execute([':id' => $id]);

    if ($stmt->rowCount() === 0) {
        sendJson(false, 404, 'Staff profile not found');
    }

    if ($targetName) {
        logActivity($db, $currentUser, 'staff.deactivated', 'user', $id, $targetName, $currentUser['name'] . ' deactivated staff member ' . $targetName);
    }

    sendJson(true, 200, ['id' => $id]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
