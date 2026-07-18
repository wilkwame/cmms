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