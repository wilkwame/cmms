<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

// Permanently removes a user account — distinct from deactivate_staff.php,
// which is a reversible soft-delete that preserves history.
//
// By default, an account with any real activity (a report they submitted,
// a work order they were assigned or that they assigned, logged activity)
// is refused, since users(id) is referenced by foreign keys on those rows.
// Passing "force": true instead reassigns that history rather than
// deleting it out from under other people's records: reports/work orders
// they created are reattributed to the admin performing this deletion,
// work orders assigned TO them become unassigned (so they re-enter the
// queue for reassignment), and their own activity-log entries are removed.
// Nothing belonging to OTHER users is touched.

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$currentUser = requireRole(['admin']);

$body = json_decode(file_get_contents('php://input'), true);
$targetId = (int) ($body['id'] ?? 0);
$force = !empty($body['force']);

if ($targetId <= 0) {
    sendJson(false, 400, 'id is required');
}
if ($targetId === $currentUser['id']) {
    sendJson(false, 400, 'You cannot delete your own account');
}

try {
    $db = connectToDatabase();

    $userStmt = $db->prepare('SELECT id, name, role FROM users WHERE id = :id');
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

    $reportCount    = (int) $reportsStmt->fetchColumn();
    $woCount        = (int) $woStmt->fetchColumn();
    $activityCount  = (int) $activityStmt->fetchColumn();
    $hasHistory     = $reportCount > 0 || $woCount > 0 || $activityCount > 0;

    if ($hasHistory && !$force) {
        sendJson(false, 409, 'This account has reports or work order history and cannot be permanently deleted. Deactivate it instead to preserve records, or confirm again to force-delete and reassign its history to you.');
    }

    $db->beginTransaction();

    if ($hasHistory) {
        // Reports/work orders they created: reattribute to the admin doing
        // this deletion rather than leaving a dangling reference.
        $db->prepare('UPDATE reports SET submitted_by = :admin_id WHERE submitted_by = :id')
            ->execute([':admin_id' => $currentUser['id'], ':id' => $targetId]);
        $db->prepare('UPDATE work_orders SET assigned_by = :admin_id WHERE assigned_by = :id')
            ->execute([':admin_id' => $currentUser['id'], ':id' => $targetId]);
        // Work orders assigned TO them become unassigned, re-entering the
        // pool instead of being deleted or left pointing at a ghost user.
        $db->prepare('UPDATE work_orders SET assigned_to = NULL WHERE assigned_to = :id')
            ->execute([':id' => $targetId]);
        // Their own activity-log entries are removed; entries logged by
        // other people (e.g. reassigning work away from them) are untouched.
        $db->prepare('DELETE FROM work_order_activity WHERE actor_id = :id')
            ->execute([':id' => $targetId]);
    }

    $db->prepare('DELETE FROM notifications WHERE recipient_id = :id')->execute([':id' => $targetId]);
    $db->prepare('DELETE FROM staff_skills WHERE staff_user_id = :id')->execute([':id' => $targetId]);
    $db->prepare('DELETE FROM staff_profiles WHERE user_id = :id')->execute([':id' => $targetId]);
    $db->prepare('DELETE FROM users WHERE id = :id')->execute([':id' => $targetId]);

    logActivity($db, $currentUser, 'staff.deleted', 'user', $targetId, $target['name'], $currentUser['name'] . ' permanently deleted account for ' . $target['name'] . ($hasHistory ? ' (history reassigned)' : ''));

    $db->commit();

    sendJson(true, 200, ['deleted' => true, 'reassigned' => $hasHistory]);

} catch (PDOException $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
