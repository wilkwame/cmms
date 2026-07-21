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

// Auto-detects HTTPS (including behind a reverse proxy).
function isHttpsRequest(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

// Call before every session_start(). Session cookie only gets the Secure
// flag when the request actually is HTTPS — hardcoding it true would
// silently break login on plain-HTTP local dev, hardcoding it false would
// leave production sessions stealable over an unencrypted connection.
function configureSecureSession(): void {
    if (session_status() !== PHP_SESSION_NONE) {
        return;
    }

    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => isHttpsRequest(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

// Absolute origin + app root path for the current request, e.g.
// "https://example.com/CMMS" — used to turn relative upload URLs
// ("uploads/reports/12/x.jpg") into absolute links for outgoing email,
// since a mail client has no notion of the app's relative base like a
// browser does. Derived from SCRIPT_NAME so it works whether the app is
// deployed at the domain root or under a subdirectory.
function appBaseUrl(): string {
    $scheme = isHttpsRequest() ? 'https' : 'http';
    $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $root   = rtrim(str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/api/x.php'))), '/');
    return $scheme . '://' . $host . $root;
}