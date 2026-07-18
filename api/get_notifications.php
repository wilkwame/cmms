<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$user = requireLogin();

try {
    $db = connectToDatabase();

    $stmt = $db->prepare('
        SELECT
            id,
            recipient_id,
            title,
            body,
            is_read AS `read`,
            created_at AS `time`,
            "report" AS type
        FROM notifications
        WHERE recipient_id = :recipient_id
        ORDER BY created_at DESC
        LIMIT 20
    ');
    $stmt->execute([':recipient_id' => $user['id']]);

    $notifications = $stmt->fetchAll();

    // Convert time to timestamp
    foreach ($notifications as &$n) {
        $n['time'] = strtotime($n['time']) * 1000;
    }

    sendJson(true, 200, [
        'notifications' => $notifications,
        'total' => count($notifications)
    ]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}