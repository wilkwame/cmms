<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

// Expected multipart/form-data body:
//   report_id: int
//   photos[]:  up to 5 image files (jpeg/png/webp, <=5MB each)

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$user = requireLogin();

$reportId = (int) ($_POST['report_id'] ?? 0);
if ($reportId <= 0) {
    sendJson(false, 400, 'report_id is required');
}

$maxBytes     = 5 * 1024 * 1024;
$allowedTypes = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp',
];

try {
    $db = connectToDatabase();

    $reportStmt = $db->prepare('SELECT submitted_by FROM reports WHERE id = :id');
    $reportStmt->execute([':id' => $reportId]);
    $report = $reportStmt->fetch();

    if (!$report) {
        sendJson(false, 404, 'Report not found');
    }
    if ($user['role'] === 'reporter' && (int) $report['submitted_by'] !== $user['id']) {
        sendJson(false, 403, 'You do not have permission to attach photos to this report');
    }

    $existingCountStmt = $db->prepare('SELECT COUNT(*) FROM report_photos WHERE report_id = :id');
    $existingCountStmt->execute([':id' => $reportId]);
    $existingCount = (int) $existingCountStmt->fetchColumn();

    $files = $_FILES['photos'] ?? null;
    if (!$files) {
        sendJson(false, 400, 'No photos provided');
    }

    $fileCount = is_array($files['name']) ? count($files['name']) : 0;
    if ($existingCount + $fileCount > 5) {
        sendJson(false, 400, 'A report can have at most 5 photos');
    }

    $uploadDir = __DIR__ . '/../uploads/reports/' . $reportId . '/';
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

        $url = 'uploads/reports/' . $reportId . '/' . $filename;
        $db->prepare('INSERT INTO report_photos (report_id, url) VALUES (:report_id, :url)')
            ->execute([':report_id' => $reportId, ':url' => $url]);

        $savedUrls[] = $url;
    }

    if ($savedUrls) {
        logActivity($db, $user, 'report.photos_added', 'report', $reportId, null, $user['name'] . ' attached ' . count($savedUrls) . ' photo(s) to report #' . $reportId);
    }

    sendJson(true, 201, ['urls' => $savedUrls]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
