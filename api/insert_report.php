<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/_autoassign.php';
require_once __DIR__ . '/_notify.php';

// Expected POST body:
// {
//   "issue":       string,
//   "description": string (optional),
//   "category_id": int,
//   "location_id": int,
//   "priority":    "low" | "medium" | "high" | "urgent"
// }
// submitted_by is taken from the session, never from the client.

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$user = requireLogin();

$body = json_decode(file_get_contents('php://input'), true);

$issue       = trim((string) ($body['issue']        ?? ''));
$description = trim((string) ($body['description']  ?? ''));
$categoryId  = (int) ($body['category_id']  ?? 0);
$locationId  = (int) ($body['location_id']  ?? 0);
$submittedBy = $user['id'];
$priority    = (string) ($body['priority']  ?? 'medium');

$allowedPriorities = ['low', 'medium', 'high', 'urgent'];

if (!$issue) {
    sendJson(false, 400, 'Issue is required');
}
if ($categoryId <= 0) {
    sendJson(false, 400, 'category_id is required');
}
if ($locationId <= 0) {
    sendJson(false, 400, 'location_id is required');
}
if (!in_array($priority, $allowedPriorities, true)) {
    sendJson(false, 400, 'Invalid priority value');
}

try {
    $db = connectToDatabase();

    // Generate a sequential reference like RPT-0001
    $lastRefStmt = $db->query("SELECT reference FROM reports ORDER BY id DESC LIMIT 1");
    $lastRef     = $lastRefStmt->fetchColumn();
    $nextNumber  = $lastRef ? ((int) substr($lastRef, 4)) + 1 : 1;
    $reference   = 'RPT-' . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);

    $stmt = $db->prepare('
        INSERT INTO reports
            (reference, issue, description, category_id, location_id, submitted_by, priority, status)
        VALUES
            (:reference, :issue, :description, :category_id, :location_id, :submitted_by, :priority, "pending")
    ');

    $stmt->execute([
        ':reference'   => $reference,
        ':issue'       => $issue,
        ':description' => $description ?: null,
        ':category_id' => $categoryId,
        ':location_id' => $locationId,
        ':submitted_by'=> $submittedBy,
        ':priority'    => $priority,
    ]);

    $newId = (int) $db->lastInsertId();

    notifyUser($db, $submittedBy, 'Report Submitted', $reference . ' (' . $issue . ') has been submitted.');

    // Try to auto-assign immediately. If no eligible staff is found, the
    // report simply stays "pending" for an admin to handle manually.
    $workOrder = createWorkOrderForReport($db, $newId, $submittedBy);

    if ($workOrder) {
        notifyWorkOrderAssignment($db, $workOrder, $submittedBy);
    }

    sendJson(true, 201, [
        'id'         => $newId,
        'reference'  => $reference,
        'work_order' => $workOrder,
    ]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
