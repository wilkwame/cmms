<?php
// api/login.php

require_once __DIR__ . '/db.php';

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

// Get JSON body
$body = json_decode(file_get_contents('php://input'), true);

$email = isset($body['email']) ? trim($body['email']) : '';
$password = isset($body['password']) ? $body['password'] : '';
$remember = isset($body['remember']) ? (bool) $body['remember'] : false;

// Validation
if (empty($email)) sendJson(false, 400, 'Email is required');
if (empty($password)) sendJson(false, 400, 'Password is required');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) sendJson(false, 400, 'Invalid email format');

try {
    $db = connectToDatabase();
    
    // Find user
    $stmt = $db->prepare('
        SELECT u.id, u.name, u.email, u.password, u.role, 
               sp.department, sp.specialisation, sp.is_active
        FROM users u
        LEFT JOIN staff_profiles sp ON sp.user_id = u.id
        WHERE u.email = :email
    ');
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();
    
    if (!$user) {
        sendJson(false, 401, 'Invalid email or password');
    }
    
    // is_active comes from a LEFT JOIN against staff_profiles, so it's NULL
    // (not 0) for reporters with no staff profile — only reject explicit 0.
    if ($user['is_active'] !== null && (int) $user['is_active'] === 0) {
        sendJson(false, 403, 'Your account has been deactivated.');
    }
    
    if (!password_verify($password, $user['password'])) {
        sendJson(false, 401, 'Invalid email or password');
    }
    
    // Generate token
    $token = bin2hex(random_bytes(32));

    // Start session
    session_start();
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user_name'] = $user['name'];
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['user_role'] = $user['role'];
    $_SESSION['token'] = $token;

    // Remove password from response
    unset($user['password']);

    sendJson(true, 200, [
        'user' => $user,
        'token' => $token,
        'remember' => $remember
    ]);
    
} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}