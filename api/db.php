<?php

require_once __DIR__ . '/config.php';

function connectToDatabase(): PDO {
    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=%s',
        DB_HOST,
        DB_NAME,
        DB_CHARSET
    );

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    return new PDO($dsn, DB_USER, DB_PASS, $options);
}

function sendJson(bool $ok, int $status, mixed $data): never {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode(['ok' => $ok, 'status' => $status, 'data' => $data]);
    exit;
}

// Call before every session_start(). Auto-detects HTTPS (including behind
// a reverse proxy) so the session cookie only gets the Secure flag when it
// actually will be served over HTTPS — hardcoding it true would silently
// break login on plain-HTTP local dev, hardcoding it false would leave
// production sessions stealable over an unencrypted connection.
function configureSecureSession(): void {
    if (session_status() !== PHP_SESSION_NONE) {
        return;
    }

    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}