<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

// Returns all work orders in one payload.
// Pagination is handled client-side by slicing app.memory.workOrders.
// POST body is intentionally empty: no parameters needed.

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

requireRole(['admin', 'supervisor', 'technician']);

try {
    $db = connectToDatabase();

    $stmt = $db->query('
        SELECT
            wo.id,
            wo.reference,
            r.issue,
            r.description,
            c.name          AS category,
            l.name          AS location,
            u_to.name       AS assigned_to,
            wo.priority,
            wo.status,
            wo.due_date,
            wo.started_at,
            wo.completed_at,
            wo.notes,
            wo.created_at,
            GROUP_CONCAT(DISTINCT rp.url ORDER BY rp.id SEPARATOR \',\') AS photo_urls
        FROM work_orders wo
        JOIN reports   r    ON r.id  = wo.report_id
        JOIN categories c   ON c.id  = r.category_id
        JOIN locations  l   ON l.id  = r.location_id
        LEFT JOIN users u_to ON u_to.id = wo.assigned_to
        LEFT JOIN report_photos rp ON rp.report_id = r.id
        GROUP BY wo.id
        ORDER BY wo.created_at DESC
    ');

    $workOrders = $stmt->fetchAll();

    sendJson(true, 200, [
        'work_orders' => $workOrders,
        'total'       => count($workOrders),
    ]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
