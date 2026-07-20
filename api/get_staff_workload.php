<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

requireRole(['admin', 'supervisor', 'technician']);

try {
    $db = connectToDatabase();

    $stmt = $db->query('
        SELECT
            u.id,
            u.name,
            sp.department,
            COUNT(wo.id) AS active_jobs,
            CASE
                WHEN COUNT(wo.id) >= 5 THEN \'High\'
                WHEN COUNT(wo.id) >= 3 THEN \'Medium\'
                ELSE \'Low\'
            END AS load_level
        FROM users u
        JOIN staff_profiles sp ON sp.user_id = u.id
        LEFT JOIN work_orders wo
            ON wo.assigned_to = u.id
            AND wo.status IN (\'pending\', \'in_progress\', \'overdue\')
        WHERE u.role != \'admin\'
          AND sp.is_active = 1
        GROUP BY u.id, u.name, sp.department
        ORDER BY active_jobs DESC
    ');

    $staff = $stmt->fetchAll();

    sendJson(true, 200, [
        'staff' => $staff,
        'total' => count($staff),
    ]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
