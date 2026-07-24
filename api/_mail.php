<?php
// api/_mail.php — thin wrapper around a vendored PHPMailer (no Composer in
// this environment; see api/vendor/phpmailer/). No-ops if SMTP_HOST isn't
// configured in api/config.php, so the rest of the app keeps working before
// real credentials are supplied.

require_once __DIR__ . '/vendor/phpmailer/Exception.php';
require_once __DIR__ . '/vendor/phpmailer/PHPMailer.php';
require_once __DIR__ . '/vendor/phpmailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;

function sendMail(string $toEmail, string $toName, string $subject, string $bodyHtml): bool {
    if (empty(SMTP_HOST)) {
        error_log("[_mail.php] SMTP not configured — skipping email to $toEmail: $subject");
        return false;
    }

    $mail = new PHPMailer(true);

    try {
        $mail->isSMTP();
        $mail->Host       = SMTP_HOST;
        $mail->Port       = SMTP_PORT;
        $mail->SMTPAuth   = true;
        $mail->Username   = SMTP_USERNAME;
        $mail->Password   = SMTP_PASSWORD;
        $mail->SMTPSecure = SMTP_PORT == 465 ? 'ssl' : 'tls';

        $mail->setFrom(SMTP_FROM_EMAIL, SMTP_FROM_NAME);
        $mail->addAddress($toEmail, $toName);

        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $bodyHtml;

        $mail->send();
        return true;
    } catch (\Throwable $e) {
        $detail = ($e instanceof Exception) ? $mail->ErrorInfo : $e->getMessage();
        error_log('[_mail.php] Failed to send email: ' . $detail);
        return false;
    }
}

function sendAssignmentEmail(string $toEmail, string $toName, array $workOrder): bool {
    $subject = 'New Work Order Assigned: ' . $workOrder['reference'];

    $photosHtml = '';
    if (!empty($workOrder['photo_urls'])) {
        $baseUrl = appBaseUrl();
        $urls = explode(',', $workOrder['photo_urls']);
        $photosHtml = '<p><strong>Photos:</strong></p><div>';
        foreach ($urls as $url) {
            $absoluteUrl = $baseUrl . '/' . ltrim($url, '/');
            $photosHtml .= '<a href="' . htmlspecialchars($absoluteUrl) . '" style="display:inline-block;margin:0 8px 8px 0;">'
                . '<img src="' . htmlspecialchars($absoluteUrl) . '" alt="Report photo" width="150" style="border-radius:6px;border:1px solid #dfe3e8;" />'
                . '</a>';
        }
        $photosHtml .= '</div>';
    }

    $body = '
        <p>Hi ' . htmlspecialchars($toName) . ',</p>
        <p>A new issue has been reported and assigned to you:</p>
        <table cellpadding="4">
            <tr><td><strong>Work Order</strong></td><td>' . htmlspecialchars($workOrder['reference']) . '</td></tr>
            <tr><td><strong>Issue</strong></td><td>' . htmlspecialchars($workOrder['issue']) . '</td></tr>
            <tr><td><strong>Priority</strong></td><td>' . htmlspecialchars($workOrder['priority']) . '</td></tr>
            <tr><td><strong>Category</strong></td><td>' . htmlspecialchars($workOrder['category']) . '</td></tr>
            <tr><td><strong>Location</strong></td><td>' . htmlspecialchars($workOrder['location']) . '</td></tr>
            <tr><td><strong>Due Date</strong></td><td>' . htmlspecialchars($workOrder['due_date']) . '</td></tr>
        </table>
        <p>' . htmlspecialchars($workOrder['description'] ?? '') . '</p>
        ' . $photosHtml . '
        <p>Please acknowledge this assignment as soon as possible.</p>
        <p>Thank you,<br>CMMS System</p>
    ';
    return sendMail($toEmail, $toName, $subject, $body);
}

// Sent once, when insert_staff.php creates a new staff account — the only
// time this app ever generates a password on someone else's behalf, so it's
// the only place a plaintext password legitimately needs to leave the server.
function sendStaffWelcomeEmail(string $toEmail, string $toName, string $password, string $role): bool {
    $subject = 'Your CMMS account has been created';
    $loginUrl = appBaseUrl() . '/login.html';

    $body = '
        <p>Hi ' . htmlspecialchars($toName) . ',</p>
        <p>An administrator has created a CMMS account for you as a <strong>' . htmlspecialchars(ucfirst($role)) . '</strong>.</p>
        <table cellpadding="4">
            <tr><td><strong>Email</strong></td><td>' . htmlspecialchars($toEmail) . '</td></tr>
            <tr><td><strong>Password</strong></td><td>' . htmlspecialchars($password) . '</td></tr>
        </table>
        <p>You can log in at <a href="' . htmlspecialchars($loginUrl) . '">' . htmlspecialchars($loginUrl) . '</a> with the email and password above, or with the "Continue with Google" button using this same email address.</p>
        <p>Thank you,<br>CMMS System</p>
    ';
    return sendMail($toEmail, $toName, $subject, $body);
}
