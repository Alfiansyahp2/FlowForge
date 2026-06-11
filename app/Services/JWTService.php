<?php

namespace App\Services;

use App\Models\User;
use Exception;

class JWTService
{
    private string $key;

    public function __construct()
    {
        $this->key = env('JWT_SECRET', env('APP_KEY', 'base64:fallback-key-for-flowforge-dev-secret-only'));
    }

    /**
     * Generate a signed JWT token for a user.
     */
    public function generateToken(User $user): string
    {
        $header = json_encode([
            'alg' => 'HS256',
            'typ' => 'JWT'
        ]);
        
        $payload = json_encode([
            'sub' => $user->id,
            'tenant_id' => $user->tenant_id,
            'email' => $user->email,
            'role' => $user->role,
            'iat' => time(),
            'exp' => time() + (int)env('JWT_TTL', 3600), // Default expiry: 1 hour
        ]);

        $base64UrlHeader = $this->base64UrlEncode($header);
        $base64UrlPayload = $this->base64UrlEncode($payload);

        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $this->key, true);
        $base64UrlSignature = $this->base64UrlEncode($signature);

        return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
    }

    /**
     * Validate a token and return its payload if valid, or null.
     */
    public function validateToken(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        [$base64UrlHeader, $base64UrlPayload, $base64UrlSignature] = $parts;

        $signature = $this->base64UrlDecode($base64UrlSignature);
        $expectedSignature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $this->key, true);

        if (!hash_equals($signature, $expectedSignature)) {
            return null; // Signature verification failed
        }

        $payload = json_decode($this->base64UrlDecode($base64UrlPayload), true);
        if (!$payload) {
            return null;
        }

        // Check token expiration
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            return null; // Token has expired
        }

        return $payload;
    }

    /**
     * Helper to base64url encode a string.
     */
    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    /**
     * Helper to base64url decode a string.
     */
    private function base64UrlDecode(string $data): string
    {
        return base64_decode(str_pad(strtr($data, '-_', '+/'), strlen($data) % 4, '=', STR_PAD_RIGHT));
    }
}
