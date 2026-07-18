<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

// Returns all staff (users with staff_profiles) in one payload.
// Pagination and filtering are handled client-side.

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

requireRole(['admin', 'supervisor', 'technician']);

try {
    $db = connectToDatabase();

    $stmt = $db->query('
        SELECT
            u.id,
            CONCAT("S-", LPAD(u.id, 3, "0")) AS reference,
            u.name,
            u.role,
            sp.department,
            sp.specialisation,
            sp.joined_at,
            sp.is_active,
            COUNT(wo.id) AS active_jobs
        FROM users u
        JOIN staff_profiles sp ON sp.user_id = u.id
        LEFT JOIN work_orders wo
            ON wo.assigned_to = u.id
            AND wo.status IN ("pending", "in_progress")
        GROUP BY
            u.id, u.name, u.role,
            sp.department, sp.specialisation,
            sp.joined_at, sp.is_active
        ORDER BY u.name ASC
    ');

    $staff = $stmt->fetchAll();

    sendJson(true, 200, [
        'staff' => $staff,
        'total' => count($staff),
    ]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
