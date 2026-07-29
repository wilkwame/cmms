<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/_audit.php';

// Expected POST body: { "id": int }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$user = requireRole(['admin', 'supervisor']);

$body = json_decode(file_get_contents('php://input'), true);
$id   = (int) ($body['id'] ?? 0);

if ($id <= 0) {
    sendJson(false, 400, 'Work order id is required');
}

try {
    $db = connectToDatabase();
    $db->beginTransaction();

    // Deleting a work order permanently deletes its underlying report too
    // (not just reverts it to "pending") so it doesn't reappear in the
    // Tickets queue — deleting a work order is treated as undoing the
    // ticket entirely, not un-approving it.
    $woStmt = $db->prepare('
        SELECT wo.report_id, wo.reference, r.reference AS report_reference
        FROM work_orders wo
        JOIN reports r ON r.id = wo.report_id
        WHERE wo.id = :id
    ');
    $woStmt->execute([':id' => $id]);
    $woRow = $woStmt->fetch();
    $reportId = $woRow ? $woRow['report_id'] : null;
    $reference = $woRow ? $woRow['reference'] : null;
    $reportReference = $woRow ? $woRow['report_reference'] : null;

    $db->prepare('DELETE FROM work_order_activity WHERE work_order_id = :id')->execute([':id' => $id]);
    $db->prepare('DELETE FROM work_order_photos WHERE work_order_id = :id')->execute([':id' => $id]);

    $stmt = $db->prepare('DELETE FROM work_orders WHERE id = :id');
    $stmt->execute([':id' => $id]);

    if ($stmt->rowCount() === 0) {
        $db->rollBack();
        sendJson(false, 404, 'Work order not found');
    }

    if ($reportId) {
        $db->prepare('DELETE FROM report_feedback WHERE report_id = :id')->execute([':id' => $reportId]);
        $db->prepare('DELETE FROM report_photos WHERE report_id = :id')->execute([':id' => $reportId]);
        $db->prepare('DELETE FROM reports WHERE id = :id')->execute([':id' => $reportId]);
    }

    if ($reference) {
        logActivity($db, $user, 'work_order.deleted', 'work_order', $id, $reference, $user['name'] . ' deleted work order ' . $reference . ' and its ticket ' . ($reportReference ?: ''));
    }

    $db->commit();

    // Best-effort cleanup of uploaded photo files; DB rows are already gone
    // and are the source of truth, so a leftover file here is harmless.
    $uploadDir = __DIR__ . '/../uploads/work_orders/' . $id . '/';
    if (is_dir($uploadDir)) {
        foreach (glob($uploadDir . '*') as $file) {
            @unlink($file);
        }
        @rmdir($uploadDir);
    }
    if ($reportId) {
        $reportUploadDir = __DIR__ . '/../uploads/reports/' . $reportId . '/';
        if (is_dir($reportUploadDir)) {
            foreach (glob($reportUploadDir . '*') as $file) {
                @unlink($file);
            }
            @rmdir($reportUploadDir);
        }
    }

    sendJson(true, 200, ['id' => $id]);

} catch (PDOException $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
