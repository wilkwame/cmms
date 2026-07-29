<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/_audit.php';

// Expected POST body:
// {
//   "id":     int,
//   "status": "rejected"
// }
//
// "approved" is deliberately not a valid target here — create_work_order.php
// is the only path that's allowed to set it, since it only does so once a
// work order actually exists. Allowing a direct flip to "approved" here
// would let a report become "approved" with no work order at all: invisible
// to the admin queue (which only shows "pending") and with no way back.

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$user = requireRole(['admin', 'supervisor']);

$body   = json_decode(file_get_contents('php://input'), true);
$id     = (int) ($body['id']     ?? 0);
$status = (string) ($body['status'] ?? '');

$allowedStatuses = ['rejected'];

if ($id <= 0) {
    sendJson(false, 400, 'Report id is required');
}
if (!in_array($status, $allowedStatuses, true)) {
    sendJson(false, 400, 'Status must be "rejected" — use create_work_order.php to approve');
}

try {
    $db = connectToDatabase();

    $refStmt = $db->prepare('SELECT reference FROM reports WHERE id = :id');
    $refStmt->execute([':id' => $id]);
    $reference = $refStmt->fetchColumn();
    if (!$reference) {
        sendJson(false, 404, 'Report not found');
    }

    // A report with a work order has already been approved and acted on —
    // rejecting it here would leave it stuck: the reject flow immediately
    // tries to delete the report afterward (see reports.js), but
    // delete_report.php refuses to delete one that still has a work order.
    // Without this guard, that refusal happens silently and the report is
    // left orphaned at status "rejected" forever — invisible everywhere in
    // the UI (which only ever shows "pending" reports) but still counted
    // in the Dashboard's all-status report total. This is exactly the bug
    // that produced two such phantom reports before this guard existed.
    $woStmt = $db->prepare('SELECT id FROM work_orders WHERE report_id = :id LIMIT 1');
    $woStmt->execute([':id' => $id]);
    if ($woStmt->fetch()) {
        sendJson(false, 409, 'This ticket already has a work order and cannot be rejected — delete the work order instead if you want to undo it.');
    }

    $stmt = $db->prepare('UPDATE reports SET status = :status WHERE id = :id');
    $stmt->execute([':status' => $status, ':id' => $id]);

    if ($reference) {
        logActivity($db, $user, 'report.rejected', 'report', $id, $reference, $user['name'] . ' rejected report ' . $reference);
    }

    sendJson(true, 200, ['id' => $id, 'status' => $status]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
