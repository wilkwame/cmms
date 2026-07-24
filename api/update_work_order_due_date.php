<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/_notify.php';

// Lets an admin/supervisor set or adjust a work order's timeline (due
// date) — it's auto-calculated as +7 days on creation (see
// _autoassign.php), but that's just a starting point, not a fixed rule.
//
// Expected POST body: { "work_order_id": int, "due_date": "YYYY-MM-DD" }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$user = requireRole(['admin', 'supervisor']);

$body = json_decode(file_get_contents('php://input'), true);
$workOrderId = (int) ($body['work_order_id'] ?? 0);
$dueDate     = trim((string) ($body['due_date'] ?? ''));

if ($workOrderId <= 0) {
    sendJson(false, 400, 'work_order_id is required');
}

$dateObj = DateTime::createFromFormat('Y-m-d', $dueDate);
if (!$dateObj || $dateObj->format('Y-m-d') !== $dueDate) {
    sendJson(false, 400, 'due_date must be a valid date in YYYY-MM-DD format');
}

try {
    $db = connectToDatabase();

    $woStmt = $db->prepare('SELECT id, reference, status, due_date, assigned_to FROM work_orders WHERE id = :id');
    $woStmt->execute([':id' => $workOrderId]);
    $workOrder = $woStmt->fetch();

    if (!$workOrder) {
        sendJson(false, 404, 'Work order not found');
    }
    if (in_array($workOrder['status'], ['completed', 'cancelled'], true)) {
        sendJson(false, 409, 'Cannot change the timeline on a ' . $workOrder['status'] . ' work order');
    }

    $db->beginTransaction();

    $db->prepare('UPDATE work_orders SET due_date = :due_date WHERE id = :id')
        ->execute([':due_date' => $dueDate, ':id' => $workOrderId]);

    $db->prepare('
        INSERT INTO work_order_activity (work_order_id, actor_id, activity_type, previous_value, new_value, note)
        VALUES (:wo_id, :actor_id, "status_change", :previous, :new, :note)
    ')->execute([
        ':wo_id'    => $workOrderId,
        ':actor_id' => $user['id'],
        ':previous' => $workOrder['due_date'],
        ':new'      => $dueDate,
        ':note'     => 'Due date changed to ' . $dueDate . ' by ' . $user['name'],
    ]);

    logActivity($db, $user, 'work_order.due_date_changed', 'work_order', $workOrderId, $workOrder['reference'], $user['name'] . ' changed ' . $workOrder['reference'] . ' due date from ' . $workOrder['due_date'] . ' to ' . $dueDate);

    $db->commit();

    if (!empty($workOrder['assigned_to'])) {
        notifyUser(
            $db,
            (int) $workOrder['assigned_to'],
            'Work Order Timeline Updated',
            $workOrder['reference'] . ' now has a due date of ' . $dueDate . '.'
        );
    }

    $fetchStmt = $db->prepare('
        SELECT
            wo.id, wo.reference, wo.priority, wo.status, wo.due_date,
            wo.started_at, wo.completed_at,
            wo.assigned_to AS assigned_to_id,
            r.issue, r.description,
            c.name AS category, l.name AS location,
            u.name AS assigned_to,
            GROUP_CONCAT(DISTINCT rp.url ORDER BY rp.id SEPARATOR \',\') AS photo_urls,
            GROUP_CONCAT(DISTINCT wop.url ORDER BY wop.id SEPARATOR \',\') AS completion_photo_urls
        FROM work_orders wo
        JOIN reports r ON r.id = wo.report_id
        JOIN categories c ON c.id = r.category_id
        JOIN locations l ON l.id = r.location_id
        LEFT JOIN users u ON u.id = wo.assigned_to
        LEFT JOIN report_photos rp ON rp.report_id = r.id
        LEFT JOIN work_order_photos wop ON wop.work_order_id = wo.id
        WHERE wo.id = :id
        GROUP BY wo.id, wo.reference, wo.priority, wo.status, wo.due_date, wo.started_at,
                 wo.completed_at, wo.assigned_to, r.issue, r.description, c.name, l.name, u.name
    ');
    $fetchStmt->execute([':id' => $workOrderId]);

    sendJson(true, 200, $fetchStmt->fetch());

} catch (PDOException $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
