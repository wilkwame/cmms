<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/_notify.php';

// Lets a technician start/complete/cancel a work order assigned to them,
// without needing admin/supervisor rights (those roles can already do this
// via reassign/delete). Admins and supervisors may use this on any work
// order too, for convenience.
//
// Expected POST body: { "work_order_id": int, "status": "in_progress" | "completed" | "cancelled" }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$user = requireLogin();

$body = json_decode(file_get_contents('php://input'), true);
$workOrderId = (int) ($body['work_order_id'] ?? 0);
$newStatus   = (string) ($body['status'] ?? '');

$allowedTargets = ['in_progress', 'completed', 'cancelled'];

if ($workOrderId <= 0) {
    sendJson(false, 400, 'work_order_id is required');
}
if (!in_array($newStatus, $allowedTargets, true)) {
    sendJson(false, 400, 'status must be one of: ' . implode(', ', $allowedTargets));
}

try {
    $db = connectToDatabase();

    $woStmt = $db->prepare('
        SELECT wo.id, wo.reference, wo.status, wo.assigned_to, wo.report_id, wo.started_at,
               r.submitted_by, r.issue
        FROM work_orders wo
        JOIN reports r ON r.id = wo.report_id
        WHERE wo.id = :id
    ');
    $woStmt->execute([':id' => $workOrderId]);
    $workOrder = $woStmt->fetch();

    if (!$workOrder) {
        sendJson(false, 404, 'Work order not found');
    }

    $isPrivileged = in_array($user['role'], ['admin', 'supervisor'], true);
    $isOwner = (int) $workOrder['assigned_to'] === $user['id'];
    if (!$isPrivileged && !$isOwner) {
        sendJson(false, 403, 'You can only update work orders assigned to you');
    }

    if (in_array($workOrder['status'], ['completed', 'cancelled'], true)) {
        sendJson(false, 409, 'This work order is already ' . $workOrder['status'] . ' and cannot be changed');
    }
    if ($workOrder['status'] === $newStatus) {
        sendJson(false, 409, 'Work order is already ' . $newStatus);
    }

    $setClauses = ['status = :status'];
    $params = [':status' => $newStatus, ':id' => $workOrderId];

    if ($newStatus === 'in_progress' && empty($workOrder['started_at'])) {
        $setClauses[] = 'started_at = NOW()';
    }
    if ($newStatus === 'completed') {
        $setClauses[] = 'completed_at = NOW()';
        if (empty($workOrder['started_at'])) {
            $setClauses[] = 'started_at = NOW()';
        }
    }

    $db->beginTransaction();

    $db->prepare('UPDATE work_orders SET ' . implode(', ', $setClauses) . ' WHERE id = :id')
        ->execute($params);

    $activityType = $newStatus === 'in_progress' ? 'start' : ($newStatus === 'completed' ? 'complete' : 'status_change');
    $db->prepare('
        INSERT INTO work_order_activity (work_order_id, actor_id, activity_type, previous_value, new_value, note)
        VALUES (:wo_id, :actor_id, :activity_type, :previous, :new, :note)
    ')->execute([
        ':wo_id'         => $workOrderId,
        ':actor_id'      => $user['id'],
        ':activity_type' => $activityType,
        ':previous'      => $workOrder['status'],
        ':new'           => $newStatus,
        ':note'          => 'Marked ' . $newStatus . ' by ' . $user['name'],
    ]);

    // "closed" is the report-side terminal state once its work order is done.
    if ($newStatus === 'completed') {
        $db->prepare('UPDATE reports SET status = "closed" WHERE id = :report_id')
            ->execute([':report_id' => $workOrder['report_id']]);
    }

    $db->commit();

    notifyAdmins($db, 'Work Order ' . ucfirst(str_replace('_', ' ', $newStatus)), $workOrder['reference'] . ' was marked ' . $newStatus . ' by ' . $user['name'] . '.');

    if (!empty($workOrder['submitted_by']) && in_array($newStatus, ['in_progress', 'completed'], true)) {
        $reporterMessage = $newStatus === 'completed'
            ? 'Your report "' . $workOrder['issue'] . '" (' . $workOrder['reference'] . ') has been resolved.'
            : 'Work has started on your report "' . $workOrder['issue'] . '" (' . $workOrder['reference'] . ').';
        notifyUser($db, (int) $workOrder['submitted_by'], 'Report Status Update', $reporterMessage);
    }

    $fetchStmt = $db->prepare('
        SELECT
            wo.id, wo.reference, wo.priority, wo.status, wo.due_date,
            wo.started_at, wo.completed_at,
            wo.assigned_to AS assigned_to_id,
            r.issue, r.description,
            c.name AS category, l.name AS location,
            u.name AS assigned_to,
            GROUP_CONCAT(rp.url ORDER BY rp.id SEPARATOR \',\') AS photo_urls
        FROM work_orders wo
        JOIN reports r ON r.id = wo.report_id
        JOIN categories c ON c.id = r.category_id
        JOIN locations l ON l.id = r.location_id
        LEFT JOIN users u ON u.id = wo.assigned_to
        LEFT JOIN report_photos rp ON rp.report_id = r.id
        WHERE wo.id = :id
        GROUP BY wo.id, wo.reference, wo.priority, wo.status, wo.due_date, wo.started_at,
                 wo.completed_at, wo.assigned_to, r.issue, r.description, c.name, l.name, u.name
    ');
    $fetchStmt->execute([':id' => $workOrderId]);

    sendJson(true, 200, $fetchStmt->fetch());

} catch (PDOException $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
