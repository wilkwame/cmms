<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

requireRole(['admin']);

try {
    $db = connectToDatabase();

    // work_orders has no category of its own — it's always reached by
    // joining through reports.category_id.
    $stmt = $db->query('
        SELECT c.id, c.name,
               COUNT(DISTINCT r.id)  AS report_count,
               COUNT(DISTINCT wo.id) AS work_order_count
        FROM categories c
        LEFT JOIN reports r ON r.category_id = c.id
        LEFT JOIN work_orders wo ON wo.report_id = r.id
        GROUP BY c.id, c.name
        ORDER BY report_count DESC
    ');
    $rows = $stmt->fetchAll();

    foreach ($rows as &$row) {
        $row['report_count'] = (int) $row['report_count'];
        $row['work_order_count'] = (int) $row['work_order_count'];
    }
    unset($row);

    sendJson(true, 200, ['categories' => $rows]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
