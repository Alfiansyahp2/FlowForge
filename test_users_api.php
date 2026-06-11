<?php
// Quick API test — run with: php test_users_api.php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;

// Get admin and create a temp token
$admin = User::withoutGlobalScopes()->where('email', 'admin@demo.com')->first();
if (!$admin) {
    die("Admin user not found\n");
}

$token = $admin->createToken('test-token')->plainTextToken;
$tenantId = $admin->tenant_id;

echo "Admin: {$admin->name} | tenant_id: {$tenantId}\n";
echo "Token: " . substr($token, 0, 30) . "...\n\n";

// Call the API
$ch = curl_init('http://localhost:8000/api/users');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $token,
        'X-Tenant-ID: ' . $tenantId,
        'Accept: application/json',
        'Content-Type: application/json',
    ],
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP Status: {$httpCode}\n";
echo "Response:\n";
$decoded = json_decode($response, true);
echo json_encode($decoded, JSON_PRETTY_PRINT) . "\n";

// Clean up test token
$admin->tokens()->where('name', 'test-token')->delete();
echo "\nTest token cleaned up.\n";
