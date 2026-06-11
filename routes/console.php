<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Schedule the due schedules runner to run every minute
Schedule::command('schedules:run-due')->everyMinute()->description('Run due workflow schedules');
