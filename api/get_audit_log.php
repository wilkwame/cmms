<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

requireRole(['admin', 'supervisor']);

try {
    $db = connectToDatabase();

    // Unlike other listing endpoints in this app (which return everything
    // for client-side pagination), the audit log grows unbounded, so this
    // caps at the most recent 500 events server-side.
    $stmt = $db->query('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 500');
    $rows = $stmt->fetchAll();

    sendJson(true, 200, ['logs' => $rows, 'total' => count($rows)]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
