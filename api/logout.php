<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$user = currentUser();

if ($user) {
    try {
        $db = connectToDatabase();
        logActivity($db, $user, 'logout', 'user', $user['id'], $user['name'], $user['name'] . ' logged out');
    } catch (PDOException $e) {
        // Logging failure shouldn't block logout.
    }
}

session_unset();
session_destroy();

sendJson(true, 200, ['ok' => true]);
