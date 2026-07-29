<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/_audit.php';

// Assigns a location to a department — this is what makes a ticket
// "departmental": get_reports.php/get_work_orders.php scope a supervisor's
// view by joining through report -> location -> department.
//
// Expected POST body: { "location_id": int, "department_id": int|null }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$user = requireRole(['admin']);

$body         = json_decode(file_get_contents('php://input'), true);
$locationId   = (int) ($body['location_id'] ?? 0);
$departmentId = isset($body['department_id']) && $body['department_id'] !== null && $body['department_id'] !== ''
    ? (int) $body['department_id']
    : null;

if ($locationId <= 0) {
    sendJson(false, 400, 'location_id is required');
}

try {
    $db = connectToDatabase();

    $locStmt = $db->prepare('SELECT id, name FROM locations WHERE id = :id');
    $locStmt->execute([':id' => $locationId]);
    $location = $locStmt->fetch();
    if (!$location) {
        sendJson(false, 404, 'Location not found');
    }

    if ($departmentId !== null) {
        $deptStmt = $db->prepare('SELECT id, name FROM departments WHERE id = :id');
        $deptStmt->execute([':id' => $departmentId]);
        $department = $deptStmt->fetch();
        if (!$department) {
            sendJson(false, 404, 'Department not found');
        }
    }

    $db->prepare('UPDATE locations SET department_id = :department_id WHERE id = :id')
        ->execute([':department_id' => $departmentId, ':id' => $locationId]);

    logActivity(
        $db,
        $user,
        'location.department_changed',
        'location',
        $locationId,
        $location['name'],
        $user['name'] . ' set ' . $location['name'] . '\'s department to ' . ($departmentId !== null ? $department['name'] : 'none')
    );

    sendJson(true, 200, [
        'id'              => $locationId,
        'department_id'   => $departmentId,
        'department_name' => $departmentId !== null ? $department['name'] : null,
    ]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
