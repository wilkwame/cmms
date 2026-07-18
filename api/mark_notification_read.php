<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

// Expected POST body: { "id": int } — omit "id" to mark all of the
// current user's notifications as read.

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$user = requireLogin();

$body = json_decode(file_get_contents('php://input'), true);
$id   = (int) ($body['id'] ?? 0);

try {
    $db = connectToDatabase();

    if ($id > 0) {
        $stmt = $db->prepare('UPDATE notifications SET is_read = 1 WHERE id = :id AND recipient_id = :recipient_id');
        $stmt->execute([':id' => $id, ':recipient_id' => $user['id']]);
    } else {
        $stmt = $db->prepare('UPDATE notifications SET is_read = 1 WHERE recipient_id = :recipient_id');
        $stmt->execute([':recipient_id' => $user['id']]);
    }

    sendJson(true, 200, ['updated' => $stmt->rowCount()]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
