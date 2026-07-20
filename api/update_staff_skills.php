<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

// Turns any registered user into (or updates) assignable staff — creates
// their staff_profiles row if they don't have one yet (e.g. someone who
// signed up via Google as a reporter), rather than requiring a separate
// "Add Staff" account. Role is left untouched: it only controls which
// dashboard they land on, not whether they can receive assigned work.
//
// Expected POST body: { "user_id": int, "department": string, "skills": int[] }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

requireRole(['admin']);

$body       = json_decode(file_get_contents('php://input'), true);
$userId     = (int) ($body['user_id'] ?? 0);
$department = isset($body['department']) ? trim($body['department']) : '';
$skills     = isset($body['skills']) && is_array($body['skills']) ? array_map('intval', $body['skills']) : [];

if ($userId <= 0) {
    sendJson(false, 400, 'user_id is required');
}
if (empty($department)) {
    sendJson(false, 400, 'department is required');
}
if (empty($skills)) {
    sendJson(false, 400, 'At least one skill is required');
}

try {
    $db = connectToDatabase();

    $userStmt = $db->prepare('SELECT id FROM users WHERE id = :id');
    $userStmt->execute([':id' => $userId]);
    if (!$userStmt->fetch()) {
        sendJson(false, 404, 'User not found');
    }

    $db->beginTransaction();

    $namesStmt = $db->prepare('SELECT name FROM categories WHERE id IN (' . implode(',', array_fill(0, count($skills), '?')) . ')');
    $namesStmt->execute($skills);
    $specialisation = implode(', ', array_column($namesStmt->fetchAll(), 'name'));

    $db->prepare('
        INSERT INTO staff_profiles (user_id, department, specialisation, joined_at, is_active)
        VALUES (:user_id, :department, :specialisation, CURDATE(), 1)
        ON DUPLICATE KEY UPDATE
            department = VALUES(department),
            specialisation = VALUES(specialisation),
            is_active = 1
    ')->execute([
        ':user_id' => $userId,
        ':department' => $department,
        ':specialisation' => $specialisation,
    ]);

    $db->prepare('DELETE FROM staff_skills WHERE staff_user_id = :user_id')
        ->execute([':user_id' => $userId]);

    $skillStmt = $db->prepare('INSERT INTO staff_skills (staff_user_id, category_id) VALUES (:user_id, :category_id)');
    foreach ($skills as $categoryId) {
        $skillStmt->execute([':user_id' => $userId, ':category_id' => $categoryId]);
    }

    $db->commit();

    sendJson(true, 200, [
        'user_id' => $userId,
        'department' => $department,
        'skills' => $skills,
        'specialisation' => $specialisation,
    ]);

} catch (PDOException $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
