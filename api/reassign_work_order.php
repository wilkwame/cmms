<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/_notify.php';

// Expected POST body: { "work_order_id": int, "assigned_to": int }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$user = requireRole(['admin', 'supervisor']);

$body = json_decode(file_get_contents('php://input'), true);
$workOrderId = (int) ($body['work_order_id'] ?? 0);
$newAssignee  = (int) ($body['assigned_to'] ?? 0);

if ($workOrderId <= 0) {
    sendJson(false, 400, 'work_order_id is required');
}
if ($newAssignee <= 0) {
    sendJson(false, 400, 'assigned_to is required');
}

try {
    $db = connectToDatabase();

    $woStmt = $db->prepare('
        SELECT wo.id, wo.reference, wo.status, u.name AS current_assignee
        FROM work_orders wo
        LEFT JOIN users u ON u.id = wo.assigned_to
        WHERE wo.id = :id
    ');
    $woStmt->execute([':id' => $workOrderId]);
    $workOrder = $woStmt->fetch();

    if (!$workOrder) {
        sendJson(false, 404, 'Work order not found');
    }
    if (in_array($workOrder['status'], ['completed', 'cancelled'], true)) {
        sendJson(false, 409, 'Cannot reassign a ' . $workOrder['status'] . ' work order');
    }

    $staffStmt = $db->prepare('
        SELECT u.id, u.name
        FROM users u
        JOIN staff_profiles sp ON sp.user_id = u.id
        WHERE u.id = :id AND sp.is_active = 1 AND u.role != "admin"
    ');
    $staffStmt->execute([':id' => $newAssignee]);
    $newStaff = $staffStmt->fetch();

    if (!$newStaff) {
        sendJson(false, 404, 'Selected staff member is not active or not found');
    }

    $db->prepare('UPDATE work_orders SET assigned_to = :assigned_to WHERE id = :id')
        ->execute([':assigned_to' => $newAssignee, ':id' => $workOrderId]);

    $db->prepare('
        INSERT INTO work_order_activity (work_order_id, actor_id, activity_type, previous_value, new_value, note)
        VALUES (:wo_id, :actor_id, "reassign", :previous, :new, :note)
    ')->execute([
        ':wo_id'    => $workOrderId,
        ':actor_id' => $user['id'],
        ':previous' => $workOrder['current_assignee'] ?: 'Unassigned',
        ':new'      => $newStaff['name'],
        ':note'     => 'Reassigned by ' . $user['name'],
    ]);

    notifyUser(
        $db,
        $newStaff['id'],
        'Work Order Reassigned To You',
        $workOrder['reference'] . ' has been reassigned to you.'
    );

    $fetchStmt = $db->prepare('
        SELECT
            wo.id, wo.reference, wo.priority, wo.status, wo.due_date,
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
        GROUP BY wo.id
    ');
    $fetchStmt->execute([':id' => $workOrderId]);

    sendJson(true, 200, $fetchStmt->fetch());

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
