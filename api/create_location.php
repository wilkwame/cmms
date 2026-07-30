<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/_audit.php';

// Lets an Administrator add a new physical location directly, rather than
// only being able to categorise locations that already exist (which used
// to only ever get created implicitly by a reporter's "Other" ticket
// submission — see insert_report.php).
//
// Expected POST body: { "name": string, "department_id": int|null }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$user = requireRole(['admin']);

$body         = json_decode(file_get_contents('php://input'), true);
$name         = trim((string) ($body['name'] ?? ''));
$departmentId = isset($body['department_id']) && $body['department_id'] !== null && $body['department_id'] !== ''
    ? (int) $body['department_id']
    : null;

if (!$name) {
    sendJson(false, 400, 'Location name is required');
}

try {
    $db = connectToDatabase();

    $existingStmt = $db->prepare('SELECT id FROM locations WHERE LOWER(name) = LOWER(:name) LIMIT 1');
    $existingStmt->execute([':name' => $name]);
    if ($existingStmt->fetch()) {
        sendJson(false, 409, 'A location with that name already exists');
    }

    $department = null;
    if ($departmentId !== null) {
        $deptStmt = $db->prepare('SELECT id, name FROM departments WHERE id = :id');
        $deptStmt->execute([':id' => $departmentId]);
        $department = $deptStmt->fetch();
        if (!$department) {
            sendJson(false, 404, 'Department not found');
        }
    }

    $stmt = $db->prepare('INSERT INTO locations (name, department_id) VALUES (:name, :department_id)');
    $stmt->execute([':name' => $name, ':department_id' => $departmentId]);
    $newId = (int) $db->lastInsertId();

    logActivity($db, $user, 'location.created', 'location', $newId, $name, $user['name'] . ' added location ' . $name . ($department ? ' (department: ' . $department['name'] . ')' : ''));

    sendJson(true, 201, [
        'id'              => $newId,
        'name'            => $name,
        'department_id'   => $departmentId,
        'department_name' => $department ? $department['name'] : null,
    ]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
