<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

// Per-technician performance over an optional date range — completed jobs
// (throughput), current active jobs (context, not date-scoped), and average
// time from started_at to completed_at for jobs finished in that range.
//
// Expected POST body: { "start_date": "YYYY-MM-DD"|null, "end_date": "YYYY-MM-DD"|null }
// Both omitted/blank = all time.

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

requireRole(['admin']);

$body      = json_decode(file_get_contents('php://input'), true) ?: [];
$startDate = isset($body['start_date']) && $body['start_date'] !== '' ? (string) $body['start_date'] : null;
$endDate   = isset($body['end_date']) && $body['end_date'] !== '' ? (string) $body['end_date'] : null;

if ($startDate !== null && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate)) $startDate = null;
if ($endDate !== null && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) $endDate = null;

try {
    $db = connectToDatabase();

    // Separate placeholder names per occurrence — the same CASE condition
    // is used twice in the SELECT (completed count, average duration), and
    // this keeps parameter binding unambiguous either way.
    $completedCond = '';
    $avgCond = '';
    $params = [];
    if ($startDate !== null) {
        $completedCond .= ' AND wo.completed_at >= :cstart';
        $avgCond .= ' AND wo.completed_at >= :astart';
        $params[':cstart'] = $startDate . ' 00:00:00';
        $params[':astart'] = $startDate . ' 00:00:00';
    }
    if ($endDate !== null) {
        $completedCond .= ' AND wo.completed_at <= :cend';
        $avgCond .= ' AND wo.completed_at <= :aend';
        $params[':cend'] = $endDate . ' 23:59:59';
        $params[':aend'] = $endDate . ' 23:59:59';
    }

    $sql = '
        SELECT
            u.id,
            CONCAT("S-", LPAD(u.id, 3, "0")) AS reference,
            u.name,
            d.name AS department_name,
            sp.specialisation,
            COUNT(DISTINCT CASE WHEN wo.status = "completed"' . $completedCond . ' THEN wo.id END) AS completed_jobs,
            COUNT(DISTINCT CASE WHEN wo.status IN ("pending", "in_progress") THEN wo.id END) AS active_jobs,
            AVG(CASE WHEN wo.status = "completed" AND wo.started_at IS NOT NULL' . $avgCond . '
                THEN TIMESTAMPDIFF(MINUTE, wo.started_at, wo.completed_at) END) AS avg_completion_minutes
        FROM users u
        LEFT JOIN staff_profiles sp ON sp.user_id = u.id
        LEFT JOIN departments d ON d.id = sp.department_id
        LEFT JOIN work_orders wo ON wo.assigned_to = u.id
        WHERE u.role = "technician"
        GROUP BY u.id, u.name, d.name, sp.specialisation
        ORDER BY completed_jobs DESC, u.name ASC
    ';

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $staff = $stmt->fetchAll();

    foreach ($staff as &$row) {
        $row['completed_jobs'] = (int) $row['completed_jobs'];
        $row['active_jobs'] = (int) $row['active_jobs'];
        $row['avg_completion_minutes'] = $row['avg_completion_minutes'] !== null
            ? (int) round((float) $row['avg_completion_minutes'])
            : null;
    }
    unset($row);

    sendJson(true, 200, [
        'staff'      => $staff,
        'start_date' => $startDate,
        'end_date'   => $endDate,
    ]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
