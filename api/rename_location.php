<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/_audit.php';

// Lets an Administrator correct/rename an existing location's name (e.g. a
// typo, or standardizing "Block D" vs "block d" entries created via a
// reporter's free-text "Other" submission — see insert_report.php).
//
// Expected POST body: { "location_id": int, "name": string }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$user = requireRole(['admin']);

$body       = json_decode(file_get_contents('php://input'), true);
$locationId = (int) ($body['location_id'] ?? 0);
$name       = trim((string) ($body['name'] ?? ''));

if ($locationId <= 0) {
    sendJson(false, 400, 'location_id is required');
}
if (!$name) {
    sendJson(false, 400, 'Location name is required');
}

try {
    $db = connectToDatabase();

    $locStmt = $db->prepare('SELECT id, name FROM locations WHERE id = :id');
    $locStmt->execute([':id' => $locationId]);
    $location = $locStmt->fetch();
    if (!$location) {
        sendJson(false, 404, 'Location not found');
    }

    $dupStmt = $db->prepare('SELECT id FROM locations WHERE LOWER(name) = LOWER(:name) AND id != :id LIMIT 1');
    $dupStmt->execute([':name' => $name, ':id' => $locationId]);
    if ($dupStmt->fetch()) {
        sendJson(false, 409, 'A location with that name already exists');
    }

    $db->prepare('UPDATE locations SET name = :name WHERE id = :id')
        ->execute([':name' => $name, ':id' => $locationId]);

    logActivity(
        $db,
        $user,
        'location.renamed',
        'location',
        $locationId,
        $name,
        $user['name'] . ' renamed location "' . $location['name'] . '" to "' . $name . '"'
    );

    sendJson(true, 200, [
        'id'   => $locationId,
        'name' => $name,
    ]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
