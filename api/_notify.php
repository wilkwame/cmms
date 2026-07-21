<?php
// api/_notify.php — in-app notification rows (notifications table already
// exists in schema.sql). Email is a separate, best-effort add-on via _mail.php.

function notifyUser(PDO $db, int $recipientId, string $title, string $body): void {
    $db->prepare('INSERT INTO notifications (recipient_id, title, body) VALUES (:recipient_id, :title, :body)')
        ->execute([':recipient_id' => $recipientId, ':title' => $title, ':body' => $body]);
}

function notifyAdmins(PDO $db, string $title, string $body): void {
    $stmt = $db->query('SELECT id FROM users WHERE role = "admin"');
    foreach ($stmt->fetchAll() as $admin) {
        notifyUser($db, (int) $admin['id'], $title, $body);
    }
}

// Notifies the assignee and admins that a work order was auto-created, and
// emails the assignee. $workOrder is the row shape returned by
// createWorkOrderForReport() in _autoassign.php (including photo_urls).
//
// The reporter is deliberately not notified here — reporters don't receive
// notifications about their own reports, by design.
function notifyWorkOrderAssignment(PDO $db, array $workOrder): void {
    $refLine = $workOrder['reference'] . ' (' . $workOrder['issue'] . ')';
    $photoCount = empty($workOrder['photo_urls']) ? 0 : count(explode(',', $workOrder['photo_urls']));
    $photoNote = $photoCount > 0 ? ' ' . $photoCount . ' photo' . ($photoCount === 1 ? '' : 's') . ' attached.' : '';

    if (!empty($workOrder['assigned_to_id'])) {
        notifyUser(
            $db,
            (int) $workOrder['assigned_to_id'],
            'New Work Order Assigned',
            $refLine . ' has been assigned to you. Due ' . $workOrder['due_date'] . '.' . $photoNote
        );

        $assigneeStmt = $db->prepare('SELECT name, email FROM users WHERE id = :id');
        $assigneeStmt->execute([':id' => $workOrder['assigned_to_id']]);
        $assignee = $assigneeStmt->fetch();
        if ($assignee) {
            require_once __DIR__ . '/_mail.php';
            sendAssignmentEmail($assignee['email'], $assignee['name'], $workOrder);
        }
    }

    notifyAdmins($db, 'Work Order Created', $refLine . ' was auto-assigned to ' . ($workOrder['assigned_to'] ?: 'nobody yet') . '.');
}
