<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

// Expected POST body: { "id": int }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

requireRole(['admin', 'supervisor']);

$body = json_decode(file_get_contents('php://input'), true);
$id   = (int) ($body['id'] ?? 0);

if ($id <= 0) {
    sendJson(false, 400, 'Work order id is required');
}

try {
    $db = connectToDatabase();
    $db->beginTransaction();

    // Deleting the work order without resetting the report status would
    // leave the report stuck "approved" forever with no work order and no
    // way back into the pending queue (get_reports.php's admin view only
    // shows status = "pending") — an invisible orphan nobody could recover.
    $reportIdStmt = $db->prepare('SELECT report_id FROM work_orders WHERE id = :id');
    $reportIdStmt->execute([':id' => $id]);
    $reportId = $reportIdStmt->fetchColumn();

    $db->prepare('DELETE FROM work_order_activity WHERE work_order_id = :id')->execute([':id' => $id]);

    $stmt = $db->prepare('DELETE FROM work_orders WHERE id = :id');
    $stmt->execute([':id' => $id]);

    if ($stmt->rowCount() === 0) {
        $db->rollBack();
        sendJson(false, 404, 'Work order not found');
    }

    if ($reportId) {
        $db->prepare('UPDATE reports SET status = "pending" WHERE id = :id AND status IN ("approved", "closed")')
            ->execute([':id' => $reportId]);
    }

    $db->commit();
    sendJson(true, 200, ['id' => $id]);

} catch (PDOException $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
