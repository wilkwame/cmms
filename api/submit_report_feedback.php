<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/_audit.php';

// Optional, one-shot feedback from the reporter once their ticket is
// closed — a 1-5 star rating plus an optional comment.
//
// Expected POST body: { "report_id": int, "rating": int (1-5), "comment": string (optional) }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$user = requireLogin();

$body     = json_decode(file_get_contents('php://input'), true);
$reportId = (int) ($body['report_id'] ?? 0);
$rating   = (int) ($body['rating'] ?? 0);
$comment  = isset($body['comment']) ? trim((string) $body['comment']) : '';

if ($reportId <= 0) {
    sendJson(false, 400, 'report_id is required');
}
if ($rating < 1 || $rating > 5) {
    sendJson(false, 400, 'rating must be between 1 and 5');
}

try {
    $db = connectToDatabase();

    $reportStmt = $db->prepare('SELECT id, reference, submitted_by, status FROM reports WHERE id = :id');
    $reportStmt->execute([':id' => $reportId]);
    $report = $reportStmt->fetch();

    if (!$report) {
        sendJson(false, 404, 'Ticket not found');
    }
    if ((int) $report['submitted_by'] !== $user['id']) {
        sendJson(false, 403, 'You can only leave feedback on your own tickets');
    }
    if ($report['status'] !== 'closed') {
        sendJson(false, 409, 'Feedback is only available once a ticket is closed');
    }

    $existingStmt = $db->prepare('SELECT id FROM report_feedback WHERE report_id = :id');
    $existingStmt->execute([':id' => $reportId]);
    if ($existingStmt->fetch()) {
        sendJson(false, 409, 'You already left feedback for this ticket');
    }

    $db->prepare('INSERT INTO report_feedback (report_id, rating, comment) VALUES (:report_id, :rating, :comment)')
        ->execute([
            ':report_id' => $reportId,
            ':rating'    => $rating,
            ':comment'   => $comment !== '' ? $comment : null,
        ]);

    logActivity($db, $user, 'ticket.feedback_submitted', 'report', $reportId, $report['reference'], $user['name'] . ' left ' . $rating . '-star feedback on ' . $report['reference']);

    sendJson(true, 201, ['rating' => $rating, 'comment' => $comment ?: null]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
