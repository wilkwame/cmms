<?php
// api/_auth.php — session-based auth/role guards.
// Requires db.php (for sendJson) to already be loaded by the caller.

function currentUser(): ?array {
    if (session_status() === PHP_SESSION_NONE) {
        configureSecureSession();
        session_start();
    }
    if (empty($_SESSION['user_id'])) {
        return null;
    }

    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }

    // The session only proves who logged in, not that the account still
    // exists — a deleted/deactivated user's still-valid session would
    // otherwise pass every check here and then fail downstream with a
    // confusing foreign-key error the first time it tries to write anything.
    $db = connectToDatabase();
    // department_id is a departmental supervisor's (or technician's) home
    // organizational department — null for admin/reporter, or for staff who
    // haven't been assigned one yet. It's what scopes a supervisor's view
    // of tickets/staff to their own department (see get_reports.php etc.).
    $stmt = $db->prepare('
        SELECT u.id, u.name, u.email, u.role, sp.department_id
        FROM users u
        LEFT JOIN staff_profiles sp ON sp.user_id = u.id
        WHERE u.id = :id
    ');
    $stmt->execute([':id' => $_SESSION['user_id']]);
    $user = $stmt->fetch();

    if (!$user) {
        session_unset();
        session_destroy();
        return null;
    }

    $cached = [
        'id'            => (int) $user['id'],
        'name'          => $user['name'],
        'email'         => $user['email'],
        'role'          => $user['role'],
        'department_id' => $user['department_id'] !== null ? (int) $user['department_id'] : null,
    ];
    return $cached;
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
