<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\WorkflowController;
use App\Http\Controllers\Api\WorkflowRunController;
use App\Http\Controllers\Api\WorkflowVersionController;
use App\Http\Controllers\Api\WebhookController;
use App\Http\Controllers\Api\ScheduleController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Public authentication routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Protected authentication routes
Route::middleware(['auth:sanctum', \App\Http\Middleware\IdentifyTenant::class])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // Workflow routes
    Route::prefix('workflows')->group(function () {
        Route::get('/', [WorkflowController::class, 'index'])->middleware('can:view workflows');
        Route::post('/', [WorkflowController::class, 'store'])->middleware('can:create workflows');
        Route::get('/{workflow}', [WorkflowController::class, 'show'])->middleware('can:view workflows');
        Route::put('/{workflow}', [WorkflowController::class, 'update'])->middleware('can:edit workflows');
        Route::delete('/{workflow}', [WorkflowController::class, 'destroy'])->middleware('can:delete workflows');
        Route::post('/{workflow}/archive', [WorkflowController::class, 'archive'])->middleware('can:edit workflows');
        Route::post('/{workflow}/activate', [WorkflowController::class, 'activate'])->middleware('can:edit workflows');
        Route::post('/{workflow}/duplicate', [WorkflowController::class, 'duplicate'])->middleware('can:create workflows');
        Route::post('/{workflow}/run', [WorkflowController::class, 'run'])->middleware('can:execute workflows');          // ← execute workflow

        // Workflow version routes
        Route::prefix('{workflow}/versions')->group(function () {
            Route::get('/', [WorkflowVersionController::class, 'index'])->middleware('can:view workflow versions');
            Route::post('/', [WorkflowVersionController::class, 'store'])->middleware('can:create workflow versions');
            Route::get('/compare', [WorkflowVersionController::class, 'compare'])->middleware('can:view workflow versions');
            Route::get('/{version}', [WorkflowVersionController::class, 'show'])->middleware('can:view workflow versions');
            Route::post('/{version}/rollback', [WorkflowVersionController::class, 'rollback'])->middleware('can:rollback workflows');
            Route::post('/{version}/activate', [WorkflowVersionController::class, 'activate'])->middleware('can:activate workflow versions');
        });
    });

    // Webhook routes
    Route::prefix('webhooks')->group(function () {
        Route::get('/', [WebhookController::class, 'index'])->middleware('can:view webhooks');
        Route::post('/', [WebhookController::class, 'store'])->middleware('can:create webhooks');
        Route::get('/{webhook}', [WebhookController::class, 'show'])->middleware('can:view webhooks');
        Route::put('/{webhook}', [WebhookController::class, 'update'])->middleware('can:edit webhooks');
        Route::delete('/{webhook}', [WebhookController::class, 'destroy'])->middleware('can:delete webhooks');
        Route::post('/{webhook}/regenerate-token', [WebhookController::class, 'regenerateToken'])->middleware('can:edit webhooks');
        Route::get('/{webhook}/url', [WebhookController::class, 'getUrl'])->middleware('can:view webhooks');
    });

    // Schedule routes
    Route::prefix('schedules')->group(function () {
        Route::get('/', [ScheduleController::class, 'index'])->middleware('can:view schedules');
        Route::post('/', [ScheduleController::class, 'store'])->middleware('can:create schedules');
        Route::get('/{schedule}', [ScheduleController::class, 'show'])->middleware('can:view schedules');
        Route::put('/{schedule}', [ScheduleController::class, 'update'])->middleware('can:edit schedules');
        Route::delete('/{schedule}', [ScheduleController::class, 'destroy'])->middleware('can:delete schedules');
        Route::post('/{schedule}/trigger', [ScheduleController::class, 'trigger'])->middleware('can:execute workflows');
        Route::post('/{schedule}/toggle', [ScheduleController::class, 'toggle'])->middleware('can:edit schedules');
    });

    // User management routes (Admin only — enforced via Spatie permissions)
    Route::prefix('users')->group(function () {
        Route::get('/', [UserController::class, 'index'])->middleware('can:view users');
        Route::post('/', [UserController::class, 'store'])->middleware('can:create users');
        Route::get('/{user}', [UserController::class, 'show'])->middleware('can:view users');
        Route::put('/{user}', [UserController::class, 'update'])->middleware('can:edit users');
        Route::delete('/{user}', [UserController::class, 'destroy'])->middleware('can:delete users');
        Route::post('/{user}/role', [UserController::class, 'assignRole'])->middleware('can:manage roles');
    });

    // Workflow runs routes
    Route::prefix('runs')->group(function () {
        Route::get('/', [WorkflowRunController::class, 'index'])->middleware('can:view workflow runs');
        Route::get('/{run}', [WorkflowRunController::class, 'show'])->middleware('can:view workflow runs');
        Route::post('/{run}/cancel', [WorkflowRunController::class, 'cancel'])->middleware('can:cancel workflow runs');
    });

    // Reverb configuration route
    Route::get('/config/reverb', function () {
        return response()->json([
            'key' => env('REVERB_APP_KEY', 'flowforge_key'),
            'host' => request()->getHost(),
            'port' => (int) env('REVERB_PORT', 8080),
        ]);
    });

    // AI Workflow routes
    Route::post('/workflows/ai/generate', [\App\Http\Controllers\Api\AIWorkflowController::class, 'generate'])->middleware('can:create workflows');
});

// Public webhook routes (for external triggers)
Route::post('/webhooks/{token}', [WebhookController::class, 'handleWebhook'])
    ->middleware('throttle:60,1'); // 60 requests per minute
// // Protected API routes (require tenant identification)
// Route::middleware(['auth:sanctum', 'tenant'])->group(function () {
//     // Workflows routes
//     Route::apiResource('workflows', 'WorkflowController');
//
//     // Workflow versions routes
//     Route::prefix('workflows/{workflow}/versions')->group(function () {
//         Route::get('/', 'WorkflowVersionController@index');
//         Route::post('/', 'WorkflowVersionController@store');
//         Route::get('/{version}', 'WorkflowVersionController@show');
//         Route::post('/{version}/activate', 'WorkflowVersionController@activate');
//         Route::post('/rollback', 'WorkflowVersionController@rollback');
//     });
//
//     // Workflow execution routes
//     Route::post('/workflows/{workflow}/run', 'WorkflowExecutionController@run');
//
//     // Workflow runs routes
//     Route::get('/runs', 'WorkflowRunController@index');
//     Route::get('/runs/{run}', 'WorkflowRunController@show');
//
//     // Webhook routes
//     Route::apiResource('webhooks', 'WebhookController');
//
//     // Schedule routes
//     Route::apiResource('schedules', 'ScheduleController');
// });
//
// // Public webhook routes (for external triggers)
// Route::post('/webhooks/{token}', 'WebhookController@handleWebhook')
//     ->middleware('throttle:60,1'); // 60 requests per minute
