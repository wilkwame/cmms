<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

// Expected POST body:
// {
//   "id":     int,
//   "status": "approved" | "rejected"
// }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

requireRole(['admin', 'supervisor']);

$body   = json_decode(file_get_contents('php://input'), true);
$id     = (int) ($body['id']     ?? 0);
$status = (string) ($body['status'] ?? '');

$allowedStatuses = ['approved', 'rejected'];

if ($id <= 0) {
    sendJson(false, 400, 'Report id is required');
}
if (!in_array($status, $allowedStatuses, true)) {
    sendJson(false, 400, 'Status must be approved or rejected');
}

try {
    $db = connectToDatabase();

    $stmt = $db->prepare('UPDATE reports SET status = :status WHERE id = :id');
    $stmt->execute([':status' => $status, ':id' => $id]);

    sendJson(true, 200, ['id' => $id, 'status' => $status]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
