<?php
// api/insert_staff.php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

requireRole(['admin']);

$body = json_decode(file_get_contents('php://input'), true);

$name = isset($body['name']) ? trim($body['name']) : '';
$email = isset($body['email']) ? trim($body['email']) : '';
$password = isset($body['password']) ? $body['password'] : '';
$role = isset($body['role']) ? $body['role'] : '';
$department = isset($body['department']) ? $body['department'] : '';
$skills = isset($body['skills']) && is_array($body['skills']) ? array_map('intval', $body['skills']) : [];
$joinedAt = isset($body['joined_at']) && $body['joined_at'] ? $body['joined_at'] : null;
$isActive = isset($body['is_active']) ? (int) $body['is_active'] : 1;

// This form exists strictly to add workers (technicians/supervisors) with a
// skill set — admins are provisioned separately, and everyone else signs up
// on their own as a "reporter" via Google login. Both roles allowed here
// are staff, matching the "assignable staff" concept in _autoassign.php.
$allowedRoles = ['supervisor', 'technician'];

// Validation
$errors = [];
if (empty($name)) $errors[] = 'Name is required';
if (empty($email)) $errors[] = 'Email is required';
if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Invalid email format';
if (empty($password)) $errors[] = 'Password is required';
if (strlen($password) < 6) $errors[] = 'Password must be at least 6 characters';
if (empty($role)) $errors[] = 'Role is required';
if ($role && !in_array($role, $allowedRoles, true)) $errors[] = 'Role must be Supervisor or Technician';
if (empty($department)) $errors[] = 'Department is required';
if (empty($skills)) $errors[] = 'At least one skill is required';
if ($joinedAt !== null && $joinedAt > date('Y-m-d')) $errors[] = 'Joined date cannot be in the future';

if (!empty($errors)) {
    sendJson(false, 400, implode(', ', $errors));
}

try {
    $db = connectToDatabase();
    
    // Check email exists
    $checkStmt = $db->prepare('SELECT id FROM users WHERE email = :email');
    $checkStmt->execute([':email' => $email]);
    if ($checkStmt->fetch()) {
        sendJson(false, 409, 'Email already exists');
    }
    
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
    
    $db->beginTransaction();
    
    // Insert user
    $userStmt = $db->prepare('
        INSERT INTO users (name, email, password, role)
        VALUES (:name, :email, :password, :role)
    ');
    $userStmt->execute([
        ':name' => $name,
        ':email' => $email,
        ':password' => $hashedPassword,
        ':role' => $role
    ]);
    
    $userId = (int) $db->lastInsertId();

    // Skill names become the free-text specialisation shown in the staff list.
    $namesStmt = $db->prepare('SELECT name FROM categories WHERE id IN (' . implode(',', array_fill(0, count($skills), '?')) . ')');
    $namesStmt->execute($skills);
    $specialisation = implode(', ', array_column($namesStmt->fetchAll(), 'name'));

    // Insert staff profile
    $profileStmt = $db->prepare('
        INSERT INTO staff_profiles (user_id, department, specialisation, joined_at, is_active)
        VALUES (:user_id, :department, :specialisation, :joined_at, :is_active)
    ');
    $profileStmt->execute([
        ':user_id' => $userId,
        ':department' => $department,
        ':specialisation' => $specialisation,
        ':joined_at' => $joinedAt,
        ':is_active' => $isActive
    ]);

    $skillStmt = $db->prepare('INSERT INTO staff_skills (staff_user_id, category_id) VALUES (:user_id, :category_id)');
    foreach ($skills as $categoryId) {
        $skillStmt->execute([':user_id' => $userId, ':category_id' => $categoryId]);
    }

    $db->commit();

    sendJson(true, 201, [
        'id' => $userId,
        'name' => $name,
        'email' => $email,
        'role' => $role,
        'department' => $department,
        'specialisation' => $specialisation,
        'is_active' => $isActive
    ]);
    
} catch (PDOException $e) {
    if ($db && $db->inTransaction()) {
        $db->rollBack();
    }
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}