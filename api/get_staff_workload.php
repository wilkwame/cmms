<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

// Staff directory visibility is admin-only company-wide, department-scoped
// for a supervisor — see get_staff.php.
$user = requireRole(['admin', 'supervisor']);

try {
    $db = connectToDatabase();

    $sql = '
        SELECT
            u.id,
            u.name,
            sp.department,
            COUNT(DISTINCT CASE WHEN wo2.status IN (\'pending\', \'in_progress\', \'overdue\') THEN wo2.id END) AS active_jobs,
            COUNT(DISTINCT CASE WHEN wo2.status = \'completed\' THEN wo2.id END) AS completed_jobs,
            CASE
                WHEN COUNT(DISTINCT CASE WHEN wo2.status IN (\'pending\', \'in_progress\', \'overdue\') THEN wo2.id END) >= 5 THEN \'High\'
                WHEN COUNT(DISTINCT CASE WHEN wo2.status IN (\'pending\', \'in_progress\', \'overdue\') THEN wo2.id END) >= 3 THEN \'Medium\'
                ELSE \'Low\'
            END AS load_level
        FROM users u
        JOIN staff_profiles sp ON sp.user_id = u.id
        LEFT JOIN work_orders wo2 ON wo2.assigned_to = u.id
        WHERE u.role != \'admin\'
          AND sp.is_active = 1
    ';
    $params = [];
    if ($user['role'] === 'supervisor') {
        $sql .= ' AND sp.department_id = :department_id';
        $params[':department_id'] = $user['department_id'] ?? -1;
    }
    $sql .= '
        GROUP BY u.id, u.name, sp.department
        ORDER BY active_jobs DESC
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
