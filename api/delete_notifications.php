<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

// Expected POST body: { "id": int } — omit "id" to permanently delete all
// of the current user's notifications. No confirmation step on purpose —
// clearing your own notification list is low-stakes and reversible in
// effect (they'll just accumulate again), not a system record worth an
// "are you sure?" interruption.

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$user = requireLogin();

$body = json_decode(file_get_contents('php://input'), true);
$id   = (int) ($body['id'] ?? 0);

try {
    $db = connectToDatabase();

    if ($id > 0) {
        $stmt = $db->prepare('DELETE FROM notifications WHERE id = :id AND recipient_id = :recipient_id');
        $stmt->execute([':id' => $id, ':recipient_id' => $user['id']]);
    } else {
        $stmt = $db->prepare('DELETE FROM notifications WHERE recipient_id = :recipient_id');
        $stmt->execute([':recipient_id' => $user['id']]);
    }

    sendJson(true, 200, ['deleted' => $stmt->rowCount()]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
