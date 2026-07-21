<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/_autoassign.php';
require_once __DIR__ . '/_notify.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$currentUser = requireRole(['admin', 'supervisor']);

$body = json_decode(file_get_contents('php://input'), true);
$reportId = (int) ($body['report_id'] ?? 0);
$forcedAssignee = isset($body['assigned_to']) && $body['assigned_to'] ? (int) $body['assigned_to'] : null;

if ($reportId <= 0) {
    sendJson(false, 400, 'report_id is required');
}

try {
    $db = connectToDatabase();

    $reportStmt = $db->prepare('SELECT id FROM reports WHERE id = :id AND status = "approved"');
    $reportStmt->execute([':id' => $reportId]);
    $report = $reportStmt->fetch();
    if (!$report) {
        sendJson(false, 404, 'Approved report not found');
    }

    $dupeStmt = $db->prepare('SELECT id FROM work_orders WHERE report_id = :report_id LIMIT 1');
    $dupeStmt->execute([':report_id' => $reportId]);
    if ($dupeStmt->fetch()) {
        sendJson(false, 409, 'Work order already exists for this report');
    }

    $workOrder = createWorkOrderForReport($db, $reportId, $currentUser['id'], $forcedAssignee);

    if (!$workOrder) {
        sendJson(false, 409, 'No active staff available to assign');
    }

    notifyWorkOrderAssignment($db, $workOrder);

    sendJson(true, 201, $workOrder);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
