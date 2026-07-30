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

// Staff directory visibility is admin-only company-wide — a supervisor
// gets the same view, but scoped to their own department only (needed to
// reassign work within it). Technicians still don't get a staff roster.
$user = requireRole(['admin', 'supervisor']);

try {
    $db = connectToDatabase();

    // COUNT(DISTINCT wo.id) / GROUP_CONCAT(DISTINCT ...) because joining both
    // work_orders and staff_skills here would otherwise fan out and inflate
    // active_jobs — same class of bug fixed earlier in get_reports.php.
    $sql = '
        SELECT
            u.id,
            CONCAT("S-", LPAD(u.id, 3, "0")) AS reference,
            u.name,
            u.email,
            u.role,
            sp.department,
            sp.department_id,
            d.name AS department_name,
            sp.specialisation,
            sp.joined_at,
            COALESCE(sp.is_active, 0) AS is_active,
            COUNT(DISTINCT CASE WHEN wo.status IN ("pending", "in_progress") THEN wo.id END) AS active_jobs,
            COUNT(DISTINCT CASE WHEN wo.status = "completed" THEN wo.id END) AS completed_jobs,
            COUNT(DISTINCT wo.id) AS total_jobs,
            GROUP_CONCAT(DISTINCT ss.category_id) AS skill_ids
        FROM users u
        LEFT JOIN staff_profiles sp ON sp.user_id = u.id
        LEFT JOIN departments d ON d.id = sp.department_id
        LEFT JOIN work_orders wo ON wo.assigned_to = u.id
        LEFT JOIN staff_skills ss ON ss.staff_user_id = u.id
    ';
    $params = [];
    if ($user['role'] === 'supervisor') {
        // A supervisor with no department of their own sees nobody, rather
        // than defaulting to the full company roster.
        $sql .= ' WHERE sp.department_id = :department_id';
        $params[':department_id'] = $user['department_id'] ?? -1;
    }
    $sql .= '
        GROUP BY
            u.id, u.name, u.email, u.role,
            sp.department, sp.department_id, d.name, sp.specialisation,
            sp.joined_at, sp.is_active
        ORDER BY u.name ASC
    ';

    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    $staff = $stmt->fetchAll();

    sendJson(true, 200, [
        'staff' => $staff,
        'total' => count($staff),
    ]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
