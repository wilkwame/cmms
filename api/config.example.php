<?php
// Copy this file to api/config.php (git-ignored) and fill in real values.
// api/config.php is never committed.

define('DB_HOST', 'localhost');
define('DB_NAME', 'cmms');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

define('GOOGLE_CLIENT_ID', '');
define('GOOGLE_CLIENT_SECRET', '');

// Leave blank to disable outgoing email — api/_mail.php no-ops until these are set.
define('SMTP_HOST', '');
define('SMTP_PORT', 587);
define('SMTP_USERNAME', '');
define('SMTP_PASSWORD', '');
define('SMTP_FROM_EMAIL', '');
define('SMTP_FROM_NAME', 'CMMS System');
