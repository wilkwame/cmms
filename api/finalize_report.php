<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/_autoassign.php';
require_once __DIR__ . '/_notify.php';

// Called by the client right after insert_report.php (and, if the reporter
// attached any, after upload_report_photos.php) to trigger auto-assignment
// and notifications now that any photos actually exist on the report. Kept
// as a separate step rather than folding into insert_report.php because
// report_photos.report_id is a FK — photos can only be uploaded once the
// report row already exists, so assigning first would always notify the
// technician before any photos were attached.
//
// Expected POST body: { "report_id": int }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$user = requireLogin();

$body = json_decode(file_get_contents('php://input'), true);
$reportId = (int) ($body['report_id'] ?? 0);

if ($reportId <= 0) {
    sendJson(false, 400, 'report_id is required');
}

try {
    $db = connectToDatabase();

    $reportStmt = $db->prepare('SELECT id, submitted_by, status FROM reports WHERE id = :id');
    $reportStmt->execute([':id' => $reportId]);
    $report = $reportStmt->fetch();

    if (!$report) {
        sendJson(false, 404, 'Report not found');
    }
    if ((int) $report['submitted_by'] !== $user['id'] && !in_array($user['role'], ['admin', 'supervisor'], true)) {
        sendJson(false, 403, 'You do not have permission to finalize this report');
    }

    // Idempotent: if a work order already exists for this report (e.g. the
    // client retried, or an admin already approved it manually in the
    // meantime), just return it rather than erroring or double-notifying.
    $existingStmt = $db->prepare('SELECT id FROM work_orders WHERE report_id = :report_id LIMIT 1');
    $existingStmt->execute([':report_id' => $reportId]);
    if ($existingStmt->fetch()) {
        sendJson(true, 200, ['already_finalized' => true]);
    }

    if ($report['status'] !== 'pending') {
        sendJson(true, 200, ['already_finalized' => true]);
    }

    // Try to auto-assign. If no eligible staff is found, the report simply
    // stays "pending" for an admin to handle manually.
    $workOrder = createWorkOrderForReport($db, $reportId, $user['id']);

    if ($workOrder) {
        notifyWorkOrderAssignment($db, $workOrder);
    }

    sendJson(true, 200, ['work_order' => $workOrder]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
