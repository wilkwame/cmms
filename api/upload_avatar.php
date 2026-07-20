<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

// Expected multipart/form-data body: avatar: a single image file (<=2MB).

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$user = requireLogin();

$maxBytes     = 2 * 1024 * 1024;
$allowedTypes = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp',
];

if (empty($_FILES['avatar']) || $_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
    sendJson(false, 400, 'No photo provided');
}

$file = $_FILES['avatar'];

if ($file['size'] > $maxBytes) {
    sendJson(false, 400, 'Photo exceeds the 2MB limit');
}

$mimeType = mime_content_type($file['tmp_name']);
if (!isset($allowedTypes[$mimeType])) {
    sendJson(false, 400, 'Unsupported image type: ' . $mimeType);
}

try {
    $db = connectToDatabase();

    $uploadDir = __DIR__ . '/../uploads/avatars/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    // Remove any previous avatar for this user (different extension possible).
    foreach (glob($uploadDir . $user['id'] . '.*') as $oldFile) {
        unlink($oldFile);
    }

    $filename = $user['id'] . '.' . $allowedTypes[$mimeType];
    $destPath = $uploadDir . $filename;

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        sendJson(false, 500, 'Failed to save photo');
    }

    // Cache-bust so the browser doesn't keep showing the old photo.
    $url = 'uploads/avatars/' . $filename . '?v=' . time();

    $db->prepare('UPDATE users SET avatar_url = :url WHERE id = :id')
        ->execute([':url' => $url, ':id' => $user['id']]);

    sendJson(true, 200, ['avatar_url' => $url]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
