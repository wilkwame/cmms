<?php
// api/google-auth.php

require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$body = json_decode(file_get_contents('php://input'), true);
$idToken = $body['id_token'] ?? '';

if (empty($idToken)) {
    sendJson(false, 400, 'ID token is required');
}

// Verify the ID token with Google
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://oauth2.googleapis.com/tokeninfo?id_token=' . $idToken);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    sendJson(false, 401, 'Invalid Google token');
}

$tokenInfo = json_decode($response, true);

// Reject tokens that weren't issued for this app's OAuth client.
if (($tokenInfo['aud'] ?? '') !== GOOGLE_CLIENT_ID) {
    sendJson(false, 401, 'Invalid Google token audience');
}

// Verify the email domain matches your institution
$allowedDomains = ['htu.edu.gh', 'htu.edu', 'gmail.com'];
$emailDomain = substr($tokenInfo['email'] ?? '', strpos($tokenInfo['email'] ?? '', '@') + 1);

if (!in_array($emailDomain, $allowedDomains)) {
    sendJson(false, 403, 'Only institutional emails are allowed');
}

try {
    $db = connectToDatabase();
    
    // Check if user exists
    $stmt = $db->prepare('
        SELECT u.id, u.name, u.email, u.role, u.avatar_url,
               sp.department, sp.specialisation, sp.is_active
        FROM users u
        LEFT JOIN staff_profiles sp ON sp.user_id = u.id
        WHERE u.email = :email
    ');
    $stmt->execute([':email' => $tokenInfo['email']]);
    $user = $stmt->fetch();
    
    // If user doesn't exist, create one
    if (!$user) {
        $hashedPassword = password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT);
        
        $insertStmt = $db->prepare('
            INSERT INTO users (name, email, password, role, created_at)
            VALUES (:name, :email, :password, "reporter", NOW())
        ');
        $insertStmt->execute([
            ':name' => $tokenInfo['name'] ?? $tokenInfo['email'],
            ':email' => $tokenInfo['email'],
            ':password' => $hashedPassword
        ]);
        
        $userId = (int) $db->lastInsertId();
        
        $fetchStmt = $db->prepare('
            SELECT id, name, email, role, avatar_url, 1 as is_active
            FROM users
            WHERE id = :id
        ');
        $fetchStmt->execute([':id' => $userId]);
        $user = $fetchStmt->fetch();
    }
    
    // is_active comes from a LEFT JOIN against staff_profiles, so it's NULL
    // (not 0) for reporters with no staff profile — only reject explicit 0.
    if ($user['is_active'] !== null && (int) $user['is_active'] === 0) {
        sendJson(false, 403, 'Your account has been deactivated.');
    }
    
    // Generate session token
    $token = bin2hex(random_bytes(32));
    
    // Start session
    session_start();
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user_name'] = $user['name'];
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['user_role'] = $user['role'];
    $_SESSION['token'] = $token;
    
    sendJson(true, 200, [
        'user' => [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'avatar_url' => $user['avatar_url']
        ],
        'token' => $token
    ]);
    
} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}