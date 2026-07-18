<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

// Expected POST body: { "user_id": int, "skills": int[] (category ids) }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

requireRole(['admin']);

$body   = json_decode(file_get_contents('php://input'), true);
$userId = (int) ($body['user_id'] ?? 0);
$skills = isset($body['skills']) && is_array($body['skills']) ? array_map('intval', $body['skills']) : [];

if ($userId <= 0) {
    sendJson(false, 400, 'user_id is required');
}
if (empty($skills)) {
    sendJson(false, 400, 'At least one skill is required');
}

try {
    $db = connectToDatabase();
    $db->beginTransaction();

    $db->prepare('DELETE FROM staff_skills WHERE staff_user_id = :user_id')
        ->execute([':user_id' => $userId]);

    $skillStmt = $db->prepare('INSERT INTO staff_skills (staff_user_id, category_id) VALUES (:user_id, :category_id)');
    foreach ($skills as $categoryId) {
        $skillStmt->execute([':user_id' => $userId, ':category_id' => $categoryId]);
    }

    $namesStmt = $db->prepare('SELECT name FROM categories WHERE id IN (' . implode(',', array_fill(0, count($skills), '?')) . ')');
    $namesStmt->execute($skills);
    $specialisation = implode(', ', array_column($namesStmt->fetchAll(), 'name'));

    $db->prepare('UPDATE staff_profiles SET specialisation = :specialisation WHERE user_id = :user_id')
        ->execute([':specialisation' => $specialisation, ':user_id' => $userId]);

    $db->commit();

    sendJson(true, 200, ['user_id' => $userId, 'skills' => $skills, 'specialisation' => $specialisation]);

} catch (PDOException $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
