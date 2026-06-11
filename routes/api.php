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
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // Workflow routes
    Route::prefix('workflows')->group(function () {
        Route::get('/', [WorkflowController::class, 'index']);
        Route::post('/', [WorkflowController::class, 'store']);
        Route::get('/{workflow}', [WorkflowController::class, 'show']);
        Route::put('/{workflow}', [WorkflowController::class, 'update']);
        Route::delete('/{workflow}', [WorkflowController::class, 'destroy']);
        Route::post('/{workflow}/archive', [WorkflowController::class, 'archive']);
        Route::post('/{workflow}/activate', [WorkflowController::class, 'activate']);
        Route::post('/{workflow}/duplicate', [WorkflowController::class, 'duplicate']);
        Route::post('/{workflow}/run', [WorkflowController::class, 'run']);          // ← execute workflow

        // Workflow version routes
        Route::prefix('{workflow}/versions')->group(function () {
            Route::get('/', [WorkflowVersionController::class, 'index']);
            Route::post('/', [WorkflowVersionController::class, 'store']);
            Route::get('/compare', [WorkflowVersionController::class, 'compare']);
            Route::get('/{version}', [WorkflowVersionController::class, 'show']);
            Route::post('/{version}/rollback', [WorkflowVersionController::class, 'rollback']);
            Route::post('/{version}/activate', [WorkflowVersionController::class, 'activate']);
        });
    });

    // Webhook routes
    Route::prefix('webhooks')->group(function () {
        Route::get('/', [WebhookController::class, 'index']);
        Route::post('/', [WebhookController::class, 'store']);
        Route::get('/{webhook}', [WebhookController::class, 'show']);
        Route::put('/{webhook}', [WebhookController::class, 'update']);
        Route::delete('/{webhook}', [WebhookController::class, 'destroy']);
        Route::post('/{webhook}/regenerate-token', [WebhookController::class, 'regenerateToken']);
        Route::get('/{webhook}/url', [WebhookController::class, 'getUrl']);
    });

    // Schedule routes
    Route::prefix('schedules')->group(function () {
        Route::get('/', [ScheduleController::class, 'index']);
        Route::post('/', [ScheduleController::class, 'store']);
        Route::get('/{schedule}', [ScheduleController::class, 'show']);
        Route::put('/{schedule}', [ScheduleController::class, 'update']);
        Route::delete('/{schedule}', [ScheduleController::class, 'destroy']);
        Route::post('/{schedule}/trigger', [ScheduleController::class, 'trigger']);
        Route::post('/{schedule}/toggle', [ScheduleController::class, 'toggle']);
    });

    // User management routes (Admin only — enforced at controller level)
    Route::prefix('users')->group(function () {
        Route::get('/', [UserController::class, 'index']);
        Route::post('/', [UserController::class, 'store']);
        Route::get('/{user}', [UserController::class, 'show']);
        Route::put('/{user}', [UserController::class, 'update']);
        Route::delete('/{user}', [UserController::class, 'destroy']);
        Route::post('/{user}/role', [UserController::class, 'assignRole']);
    });

    // Workflow runs routes
    Route::prefix('runs')->group(function () {
        Route::get('/', [WorkflowRunController::class, 'index']);
        Route::get('/{run}', [WorkflowRunController::class, 'show']);
        Route::post('/{run}/cancel', [WorkflowRunController::class, 'cancel']);
    });
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
