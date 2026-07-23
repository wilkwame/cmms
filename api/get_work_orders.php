<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

// Returns work orders in one payload — every one for admin/supervisor, but
// only a technician's own assigned ones. Technicians should only ever see
// their own submission/work history, not what other technicians have done.
// Pagination is handled client-side by slicing app.memory.workOrders.
// POST body is intentionally empty: no parameters needed.

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$user = requireRole(['admin', 'supervisor', 'technician']);

try {
    $db = connectToDatabase();

    $whereClause = '';
    $params = [];
    if ($user['role'] === 'technician') {
        $whereClause = 'WHERE wo.assigned_to = :user_id';
        $params[':user_id'] = $user['id'];
    }

    $stmt = $db->prepare('
        SELECT
            wo.id,
            wo.reference,
            r.issue,
            r.description,
            c.name          AS category,
            l.name          AS location,
            wo.assigned_to  AS assigned_to_id,
            u_to.name       AS assigned_to,
            wo.priority,
            wo.status,
            wo.due_date,
            wo.started_at,
            wo.completed_at,
            wo.notes,
            wo.created_at,
            GROUP_CONCAT(DISTINCT rp.url ORDER BY rp.id SEPARATOR \',\') AS photo_urls,
            GROUP_CONCAT(DISTINCT wop.url ORDER BY wop.id SEPARATOR \',\') AS completion_photo_urls
        FROM work_orders wo
        JOIN reports   r    ON r.id  = wo.report_id
        JOIN categories c   ON c.id  = r.category_id
        JOIN locations  l   ON l.id  = r.location_id
        LEFT JOIN users u_to ON u_to.id = wo.assigned_to
        LEFT JOIN report_photos rp ON rp.report_id = r.id
        LEFT JOIN work_order_photos wop ON wop.work_order_id = wo.id
        ' . $whereClause . '
        GROUP BY wo.id, wo.reference, r.issue, r.description, c.name, l.name,
                 wo.assigned_to, u_to.name, wo.priority, wo.status, wo.due_date,
                 wo.started_at, wo.completed_at, wo.notes, wo.created_at
        ORDER BY wo.created_at DESC
    ');
    $stmt->execute($params);

    $workOrders = $stmt->fetchAll();

    sendJson(true, 200, [
        'work_orders' => $workOrders,
        'total'       => count($workOrders),
    ]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
