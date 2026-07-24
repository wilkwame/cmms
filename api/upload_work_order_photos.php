<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

// Expected multipart/form-data body:
//   work_order_id: int
//   photos[]:      up to 5 image files (jpeg/png/webp, <=5MB each) — evidence
//                  a technician attaches when marking a work order complete.

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$user = requireLogin();

$workOrderId = (int) ($_POST['work_order_id'] ?? 0);
if ($workOrderId <= 0) {
    sendJson(false, 400, 'work_order_id is required');
}

$maxBytes     = 5 * 1024 * 1024;
$maxPhotos    = 5;
$allowedTypes = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp',
];

try {
    $db = connectToDatabase();

    $woStmt = $db->prepare('SELECT id, assigned_to FROM work_orders WHERE id = :id');
    $woStmt->execute([':id' => $workOrderId]);
    $workOrder = $woStmt->fetch();

    if (!$workOrder) {
        sendJson(false, 404, 'Work order not found');
    }

    // Same rule as update_work_order_status.php: the assigned technician,
    // or an admin/supervisor, may attach evidence.
    $isPrivileged = in_array($user['role'], ['admin', 'supervisor'], true);
    $isOwner = (int) $workOrder['assigned_to'] === $user['id'];
    if (!$isPrivileged && !$isOwner) {
        sendJson(false, 403, 'You can only attach photos to work orders assigned to you');
    }

    $existingCountStmt = $db->prepare('SELECT COUNT(*) FROM work_order_photos WHERE work_order_id = :id');
    $existingCountStmt->execute([':id' => $workOrderId]);
    $existingCount = (int) $existingCountStmt->fetchColumn();

    $files = $_FILES['photos'] ?? null;
    if (!$files) {
        sendJson(false, 400, 'No photos provided');
    }

    $fileCount = is_array($files['name']) ? count($files['name']) : 0;
    if ($existingCount + $fileCount > $maxPhotos) {
        sendJson(false, 400, 'A work order can have at most ' . $maxPhotos . ' completion photos');
    }

    $uploadDir = __DIR__ . '/../uploads/work_orders/' . $workOrderId . '/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $savedUrls = [];

    for ($i = 0; $i < $fileCount; $i++) {
        if ($files['error'][$i] !== UPLOAD_ERR_OK) {
            continue;
        }

        $mimeType = mime_content_type($files['tmp_name'][$i]);
        if (!isset($allowedTypes[$mimeType])) {
            sendJson(false, 400, 'Unsupported image type: ' . $mimeType);
        }
        if ($files['size'][$i] > $maxBytes) {
            sendJson(false, 400, 'Photo exceeds the 5MB limit');
        }

        $filename = bin2hex(random_bytes(8)) . '.' . $allowedTypes[$mimeType];
        $destPath = $uploadDir . $filename;

        if (!move_uploaded_file($files['tmp_name'][$i], $destPath)) {
            sendJson(false, 500, 'Failed to save uploaded photo');
        }

        $url = 'uploads/work_orders/' . $workOrderId . '/' . $filename;
        $db->prepare('INSERT INTO work_order_photos (work_order_id, url) VALUES (:work_order_id, :url)')
            ->execute([':work_order_id' => $workOrderId, ':url' => $url]);

        $savedUrls[] = $url;
    }

    if ($savedUrls) {
        logActivity($db, $user, 'work_order.photos_added', 'work_order', $workOrderId, null, $user['name'] . ' attached ' . count($savedUrls) . ' completion photo(s) to work order #' . $workOrderId);
    }

    sendJson(true, 201, ['urls' => $savedUrls]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
