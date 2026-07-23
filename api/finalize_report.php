<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/_autoassign.php';
require_once __DIR__ . '/_notify.php';

// Called by the client right after insert_report.php (and, if the reporter
// attached any, after upload_report_photos.php). Auto-assignment on
// submission was removed deliberately: every report now stays "pending"
// until an admin/supervisor approves it via create_work_order.php (the
// Approve button on the Reports page) — this endpoint's job is now just to
// make sure admins are told a new report needs their attention, not to
// assign it itself.
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

    $reportStmt = $db->prepare('SELECT id, submitted_by, status, reference, issue FROM reports WHERE id = :id');
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

    // Do not auto-assign or create a work order here. Report stays "pending"
    // so an admin must approve (or reject) it before it becomes a work order.
    notifyAdminsUnassigned($db, $report['reference'], $report['issue']);

    sendJson(true, 200, ['status' => 'pending']);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
