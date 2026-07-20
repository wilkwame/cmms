<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

// Returns every registered user, not just ones with a staff_profiles row —
// any account can be turned into assignable staff by giving it skills (see
// update_staff_skills.php), regardless of its login role. Pagination and
// filtering are handled client-side.

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

requireRole(['admin', 'supervisor', 'technician']);

try {
    $db = connectToDatabase();

    // COUNT(DISTINCT wo.id) / GROUP_CONCAT(DISTINCT ...) because joining both
    // work_orders and staff_skills here would otherwise fan out and inflate
    // active_jobs — same class of bug fixed earlier in get_reports.php.
    $stmt = $db->query('
        SELECT
            u.id,
            CONCAT("S-", LPAD(u.id, 3, "0")) AS reference,
            u.name,
            u.email,
            u.role,
            sp.department,
            sp.specialisation,
            sp.joined_at,
            COALESCE(sp.is_active, 0) AS is_active,
            COUNT(DISTINCT wo.id) AS active_jobs,
            GROUP_CONCAT(DISTINCT ss.category_id) AS skill_ids
        FROM users u
        LEFT JOIN staff_profiles sp ON sp.user_id = u.id
        LEFT JOIN work_orders wo
            ON wo.assigned_to = u.id
            AND wo.status IN ("pending", "in_progress")
        LEFT JOIN staff_skills ss ON ss.staff_user_id = u.id
        GROUP BY
            u.id, u.name, u.email, u.role,
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
