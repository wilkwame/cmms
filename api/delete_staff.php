<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

// Permanently removes a user account — distinct from deactivate_staff.php,
// which is a reversible soft-delete that preserves history. This is meant
// for accounts that should never have existed (test/spam signups, mistaken
// creations): an account with any real activity (a report they submitted,
// a work order they were assigned or that they assigned, logged activity)
// is refused here rather than hard-deleted, since that would either violate
// the users(id) foreign keys those rows reference or silently destroy real
// maintenance history. Deactivate is the correct tool for an account with
// history; this is only for ones without any.

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$currentUser = requireRole(['admin']);

$body = json_decode(file_get_contents('php://input'), true);
$targetId = (int) ($body['id'] ?? 0);

if ($targetId <= 0) {
    sendJson(false, 400, 'id is required');
}
if ($targetId === $currentUser['id']) {
    sendJson(false, 400, 'You cannot delete your own account');
}

try {
    $db = connectToDatabase();

    $userStmt = $db->prepare('SELECT id, role FROM users WHERE id = :id');
    $userStmt->execute([':id' => $targetId]);
    $target = $userStmt->fetch();

    if (!$target) {
        sendJson(false, 404, 'User not found');
    }

    if ($target['role'] === 'admin') {
        $adminCountStmt = $db->query('SELECT COUNT(*) FROM users WHERE role = "admin"');
        if ((int) $adminCountStmt->fetchColumn() <= 1) {
            sendJson(false, 400, 'Cannot delete the last remaining admin account');
        }
    }

    $reportsStmt = $db->prepare('SELECT COUNT(*) FROM reports WHERE submitted_by = :id');
    $reportsStmt->execute([':id' => $targetId]);

    $woStmt = $db->prepare('SELECT COUNT(*) FROM work_orders WHERE assigned_to = :id OR assigned_by = :id2');
    $woStmt->execute([':id' => $targetId, ':id2' => $targetId]);

    $activityStmt = $db->prepare('SELECT COUNT(*) FROM work_order_activity WHERE actor_id = :id');
    $activityStmt->execute([':id' => $targetId]);

    $hasHistory = ((int) $reportsStmt->fetchColumn() > 0)
        || ((int) $woStmt->fetchColumn() > 0)
        || ((int) $activityStmt->fetchColumn() > 0);

    if ($hasHistory) {
        sendJson(false, 409, 'This account has reports or work order history and cannot be permanently deleted. Deactivate it instead to preserve records.');
    }

    $db->beginTransaction();

    $db->prepare('DELETE FROM notifications WHERE recipient_id = :id')->execute([':id' => $targetId]);
    $db->prepare('DELETE FROM staff_skills WHERE staff_user_id = :id')->execute([':id' => $targetId]);
    $db->prepare('DELETE FROM staff_profiles WHERE user_id = :id')->execute([':id' => $targetId]);
    $db->prepare('DELETE FROM users WHERE id = :id')->execute([':id' => $targetId]);

    $db->commit();

    sendJson(true, 200, ['deleted' => true]);

} catch (PDOException $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
