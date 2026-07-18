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

// Notifies the assignee, the submitter, and admins that a work order was
// auto-created, and emails the assignee. $workOrder is the row shape
// returned by createWorkOrderForReport() in _autoassign.php.
function notifyWorkOrderAssignment(PDO $db, array $workOrder, int $submittedBy): void {
    $refLine = $workOrder['reference'] . ' (' . $workOrder['issue'] . ')';

    if (!empty($workOrder['assigned_to_id'])) {
        notifyUser(
            $db,
            (int) $workOrder['assigned_to_id'],
            'New Work Order Assigned',
            $refLine . ' has been assigned to you. Due ' . $workOrder['due_date'] . '.'
        );

        $assigneeStmt = $db->prepare('SELECT name, email FROM users WHERE id = :id');
        $assigneeStmt->execute([':id' => $workOrder['assigned_to_id']]);
        $assignee = $assigneeStmt->fetch();
        if ($assignee) {
            require_once __DIR__ . '/_mail.php';
            sendAssignmentEmail($assignee['email'], $assignee['name'], $workOrder);
        }
    }

    notifyUser(
        $db,
        $submittedBy,
        'Report Assigned',
        'Your report ' . $refLine . ' has been assigned to ' . ($workOrder['assigned_to'] ?: 'a technician') . '.'
    );

    notifyAdmins($db, 'Work Order Created', $refLine . ' was auto-assigned to ' . ($workOrder['assigned_to'] ?: 'nobody yet') . '.');
}
