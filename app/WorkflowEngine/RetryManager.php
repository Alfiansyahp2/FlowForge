<?php

namespace App\WorkflowEngine;

class RetryManager
{
    /**
     * Calculate retry delay with exponential backoff.
     *
     * Formula: base_delay * 2^(retry_count - 1)
     *
     * @param int $retryCount
     * @param int $baseDelay
     * @return int
     */
    public function calculateDelay(int $retryCount, int $baseDelay): int
    {
        if ($retryCount <= 0) {
            return 0;
        }

        // Exponential backoff with jitter
        $delay = $baseDelay * pow(2, $retryCount - 1);

        // Add random jitter (±25%)
        $jitter = $delay * 0.25;
        $delay += rand(-$jitter, $jitter);

        // Ensure minimum delay
        return max(1, (int) $delay);
    }

    /**
     * Check if step should be retried.
     *
     * @param int $retryCount
     * @param int $maxRetries
     * @return bool
     */
    public function shouldRetry(int $retryCount, int $maxRetries): bool
    {
        return $retryCount < $maxRetries;
    }

    /**
     * Calculate total retry duration.
     *
     * @param int $maxRetries
     * @param int $baseDelay
     * @return int
     */
    public function calculateTotalDuration(int $maxRetries, int $baseDelay): int
    {
        $total = 0;

        for ($i = 1; $i <= $maxRetries; $i++) {
            $total += $this->calculateDelay($i, $baseDelay);
        }

        return $total;
    }

    /**
     * Get retry strategy info.
     *
     * @param int $retryCount
     * @param int $maxRetries
     * @param int $baseDelay
     * @return array
     */
    public function getRetryInfo(int $retryCount, int $maxRetries, int $baseDelay): array
    {
        return [
            'current_retry' => $retryCount,
            'max_retries' => $maxRetries,
            'can_retry' => $this->shouldRetry($retryCount, $maxRetries),
            'next_delay' => $this->calculateDelay($retryCount + 1, $baseDelay),
            'total_spent' => $this->calculateTotalDuration($retryCount, $baseDelay),
            'estimated_remaining' => $this->calculateTotalDuration($maxRetries - $retryCount, $baseDelay),
        ];
    }
}
