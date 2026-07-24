<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

// Expected POST body: { "id": int }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$user = requireRole(['admin', 'supervisor']);

$body = json_decode(file_get_contents('php://input'), true);
$id   = (int) ($body['id'] ?? 0);

if ($id <= 0) {
    sendJson(false, 400, 'Report id is required');
}

try {
    $db = connectToDatabase();

    $woStmt = $db->prepare('SELECT id FROM work_orders WHERE report_id = :id LIMIT 1');
    $woStmt->execute([':id' => $id]);
    if ($woStmt->fetch()) {
        sendJson(false, 409, 'Cannot delete a report that already has a work order');
    }

    $refStmt = $db->prepare('SELECT reference FROM reports WHERE id = :id');
    $refStmt->execute([':id' => $id]);
    $reference = $refStmt->fetchColumn();

    $db->prepare('DELETE FROM report_photos WHERE report_id = :id')->execute([':id' => $id]);

    $stmt = $db->prepare('DELETE FROM reports WHERE id = :id');
    $stmt->execute([':id' => $id]);

    if ($stmt->rowCount() === 0) {
        sendJson(false, 404, 'Report not found');
    }

    if ($reference) {
        logActivity($db, $user, 'report.deleted', 'report', $id, $reference, $user['name'] . ' deleted report ' . $reference);
    }

    sendJson(true, 200, ['id' => $id]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
