<?php
// api/_auth.php — session-based auth/role guards.
// Requires db.php (for sendJson) to already be loaded by the caller.

function currentUser(): ?array {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    return [
        'id'    => (int) $_SESSION['user_id'],
        'name'  => $_SESSION['user_name'] ?? '',
        'email' => $_SESSION['user_email'] ?? '',
        'role'  => $_SESSION['user_role'] ?? '',
    ];
}

function requireLogin(): array {
    $user = currentUser();
    if (!$user) {
        sendJson(false, 401, 'Login required');
    }
    return $user;
}

function requireRole(array $allowedRoles): array {
    $user = requireLogin();
    if (!in_array($user['role'], $allowedRoles, true)) {
        sendJson(false, 403, 'You do not have permission to do this');
    }
    return $user;
}
