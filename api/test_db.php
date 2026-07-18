<?php
require_once 'your_db_file.php'; // Replace with your actual filename

try {
    $pdo = connectToDatabase();
    echo "✅ Database connection successful!<br>";
    
    // Test query
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM users");
    $result = $stmt->fetch();
    echo "Total users: " . $result['total'] . "<br>";
    
    // Send JSON test
    sendJson(true, 200, ['message' => 'Connection working!']);
    
} catch (PDOException $e) {
    echo "❌ Database connection failed: " . $e->getMessage();
}