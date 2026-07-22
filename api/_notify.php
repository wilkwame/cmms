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

// Notifies the assignee, the reporter who submitted it, and admins that a
// work order was auto-created, and emails the assignee. $workOrder is the
// row shape returned by createWorkOrderForReport() in _autoassign.php
// (including photo_urls and submitted_by).
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

        // Email is a nice-to-have side effect of assignment, not a
        // precondition for it. Skip loading PHPMailer entirely while SMTP
        // isn't configured (defined(SMTP_HOST) is false before config.php's
        // constants exist at all, empty() covers the unconfigured-but-defined
        // case) — avoids depending on a third-party library's behavior on a
        // given host for functionality that isn't even in use yet. Still
        // wrapped in try/catch(Throwable) for when it is configured, so a
        // fatal error loading/using it can never take down the actual
        // work-order creation this is attached to.
        if (defined('SMTP_HOST') && !empty(SMTP_HOST)) {
            $assigneeStmt = $db->prepare('SELECT name, email FROM users WHERE id = :id');
            $assigneeStmt->execute([':id' => $workOrder['assigned_to_id']]);
            $assignee = $assigneeStmt->fetch();
            if ($assignee) {
                try {
                    require_once __DIR__ . '/_mail.php';
                    sendAssignmentEmail($assignee['email'], $assignee['name'], $workOrder);
                } catch (\Throwable $e) {
                    error_log('[_notify.php] Assignment email failed, continuing without it: ' . $e->getMessage());
                }
            }
        }
    }

    if (!empty($workOrder['submitted_by'])) {
        notifyUser(
            $db,
            (int) $workOrder['submitted_by'],
            'Report Assigned',
            'Your report ' . $refLine . ' has been assigned to ' . ($workOrder['assigned_to'] ?: 'a technician') . '.'
        );
    }

    notifyAdmins($db, 'Work Order Created', $refLine . ' was auto-assigned to ' . ($workOrder['assigned_to'] ?: 'nobody yet') . '.');
}

// Confirms receipt to the reporter the moment they submit — separate from
// assignment, since auto-assignment can fail to find a match and the
// reporter should still know their report went through.
function notifyReportSubmitted(PDO $db, int $reporterId, string $reference, string $issue): void {
    notifyUser($db, $reporterId, 'Report Submitted', $reference . ' (' . $issue . ') has been submitted.');
}

// Auto-assignment found nobody with a matching skill — the report is stuck
// "pending" until an admin steps in, so they need to know it needs manual
// attention rather than silently sitting unnoticed in the queue.
function notifyAdminsUnassigned(PDO $db, string $reference, string $issue): void {
    notifyAdmins($db, 'Report Needs Manual Assignment', $reference . ' (' . $issue . ') has no matching staff — assign manually.');
}
