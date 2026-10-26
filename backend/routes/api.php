<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\MaintenanceController;
use App\Http\Controllers\MeController;
use App\Http\Controllers\MemberController;
use App\Http\Controllers\MileageController;
use App\Http\Controllers\ReminderController;
use App\Http\Controllers\VehicleController;
use App\Http\Controllers\Workshop\CustomerController;
use App\Http\Controllers\Workshop\WorkOrderController;
use App\Http\Controllers\WorkspaceController;
use App\Http\Controllers\WorkspaceOverviewController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API v1 de CarCare — contrato: docs/api/contrato-v1.md
|--------------------------------------------------------------------------
| Autorización en cada ruta con `can:` (policies en app/Policies):
|   view / operate / manage / own sobre el espacio del recurso.
|   Recurso de otro espacio ⇒ 404 · rol insuficiente ⇒ 403 · sin sesión ⇒ 401.
| Las rutas *Workshop (clientes, órdenes, elevadores) responden 404 en espacios personales.
*/

Route::prefix('v1')->group(function () {
    Route::get('health', HealthController::class);

    // ───────── Autenticación (Sanctum SPA) ─────────
    Route::post('auth/register', [AuthController::class, 'register']);
    Route::post('auth/login', [AuthController::class, 'login']);

    // Recuperar la contraseña (§3.1.1): públicas, 5 peticiones/min por IP con un contador por endpoint.
    Route::post('auth/forgot-password', [PasswordResetController::class, 'forgot'])->middleware('throttle:5,1,forgot-password');
    Route::post('auth/reset-password', [PasswordResetController::class, 'reset'])->middleware('throttle:5,1,reset-password');

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);

        // ───────── Cuenta ─────────
        Route::get('me', [MeController::class, 'show']);
        Route::patch('me', [MeController::class, 'update']);
        Route::put('me/password', [MeController::class, 'password']);
        Route::delete('me', [MeController::class, 'destroy']);

        // ───────── Espacios de trabajo ─────────
        Route::get('workspaces', [WorkspaceController::class, 'index']);
        Route::post('workspaces', [WorkspaceController::class, 'store']);

        Route::prefix('workspaces/{workspace}')->group(function () {
            Route::get('/', [WorkspaceController::class, 'show'])->can('view', 'workspace');
            Route::patch('/', [WorkspaceController::class, 'update'])->can('manage', 'workspace');
            Route::delete('/', [WorkspaceController::class, 'destroy'])->can('own', 'workspace');

            Route::get('members', [MemberController::class, 'index'])->can('view', 'workspace');
            Route::post('members', [MemberController::class, 'store'])->can('manage', 'workspace');
            Route::patch('members/{user}', [MemberController::class, 'update'])->can('manage', 'workspace');
            Route::delete('members/{user}', [MemberController::class, 'destroy'])->can('removeMember', ['workspace', 'user']);

            Route::get('dashboard', [WorkspaceOverviewController::class, 'dashboard'])->can('view', 'workspace');
            Route::get('activity', [WorkspaceOverviewController::class, 'activity'])->can('view', 'workspace');
            Route::get('reminders', [WorkspaceOverviewController::class, 'reminders'])->can('view', 'workspace');
            Route::get('analytics', [WorkspaceOverviewController::class, 'analytics'])->can('manage', 'workspace');

            Route::get('vehicles', [VehicleController::class, 'index'])->can('view', 'workspace');
            Route::post('vehicles', [VehicleController::class, 'store'])->can('operate', 'workspace');

            // Solo talleres.
            Route::get('customers', [CustomerController::class, 'index'])->can('viewWorkshop', 'workspace');
            Route::post('customers', [CustomerController::class, 'store'])->can('operateWorkshop', 'workspace');
            Route::get('work-orders', [WorkOrderController::class, 'index'])->can('viewWorkshop', 'workspace');
            Route::post('work-orders', [WorkOrderController::class, 'store'])->can('operateWorkshop', 'workspace');
            Route::get('bays', [WorkOrderController::class, 'bays'])->can('viewWorkshop', 'workspace');
        });

        // ───────── Vehículos ─────────
        Route::prefix('vehicles/{vehicle}')->group(function () {
            Route::get('/', [VehicleController::class, 'show'])->can('view', 'vehicle');
            Route::patch('/', [VehicleController::class, 'update'])->can('operate', 'vehicle');
            Route::delete('/', [VehicleController::class, 'destroy'])->can('manage', 'vehicle');
            Route::post('archive', [VehicleController::class, 'archive'])->can('manage', 'vehicle');
            Route::post('restore', [VehicleController::class, 'restore'])->can('manage', 'vehicle');

            Route::get('summary', [VehicleController::class, 'summary'])->can('view', 'vehicle');
            Route::get('zones', [VehicleController::class, 'zones'])->can('view', 'vehicle');
            Route::get('journal', [VehicleController::class, 'journal'])->can('view', 'vehicle');
            Route::get('report', [VehicleController::class, 'report'])->can('view', 'vehicle');

            Route::get('mileage', [MileageController::class, 'index'])->can('view', 'vehicle');
            Route::post('mileage', [MileageController::class, 'store'])->can('operate', 'vehicle');

            Route::get('maintenance', [MaintenanceController::class, 'index'])->can('view', 'vehicle');
            Route::post('maintenance', [MaintenanceController::class, 'store'])->can('operate', 'vehicle');

            // Gastos: manage (el mecánico recibe 403).
            Route::get('expenses', [ExpenseController::class, 'index'])->can('manage', 'vehicle');
            Route::post('expenses', [ExpenseController::class, 'store'])->can('manage', 'vehicle');

            Route::get('reminders', [ReminderController::class, 'index'])->can('view', 'vehicle');
            Route::post('reminders', [ReminderController::class, 'store'])->can('operate', 'vehicle');

            Route::get('documents', [DocumentController::class, 'index'])->can('view', 'vehicle');
            Route::post('documents', [DocumentController::class, 'store'])->can('operate', 'vehicle');
        });

        // ───────── Kilometraje ─────────
        Route::delete('mileage/{mileageLog}', [MileageController::class, 'destroy'])->can('operate', 'mileageLog');

        // ───────── Intervenciones ─────────
        Route::get('maintenance/{maintenanceRecord}', [MaintenanceController::class, 'show'])->can('view', 'maintenanceRecord');
        Route::patch('maintenance/{maintenanceRecord}', [MaintenanceController::class, 'update'])->can('operate', 'maintenanceRecord');
        Route::post('maintenance/{maintenanceRecord}/archive', [MaintenanceController::class, 'archive'])->can('operate', 'maintenanceRecord');
        Route::post('maintenance/{maintenanceRecord}/restore', [MaintenanceController::class, 'restore'])->can('operate', 'maintenanceRecord');

        // ───────── Gastos ─────────
        Route::patch('expenses/{expense}', [ExpenseController::class, 'update'])->can('manage', 'expense');
        Route::delete('expenses/{expense}', [ExpenseController::class, 'destroy'])->can('manage', 'expense');

        // ───────── Recordatorios ─────────
        Route::patch('reminders/{reminder}', [ReminderController::class, 'update'])->can('operate', 'reminder');
        Route::delete('reminders/{reminder}', [ReminderController::class, 'destroy'])->can('operate', 'reminder');
        Route::post('reminders/{reminder}/complete', [ReminderController::class, 'complete'])->can('operate', 'reminder');
        Route::post('reminders/{reminder}/dismiss', [ReminderController::class, 'dismiss'])->can('operate', 'reminder');

        // ───────── Documentos ─────────
        Route::get('documents/{document}/download', [DocumentController::class, 'download'])->can('view', 'document');
        Route::delete('documents/{document}', [DocumentController::class, 'destroy'])->can('operate', 'document');

        // ───────── Taller: clientes ─────────
        Route::get('customers/{customer}', [CustomerController::class, 'show'])->can('view', 'customer');
        Route::patch('customers/{customer}', [CustomerController::class, 'update'])->can('operate', 'customer');
        Route::delete('customers/{customer}', [CustomerController::class, 'destroy'])->can('manage', 'customer');
        Route::get('customers/{customer}/vehicles', [CustomerController::class, 'vehicles'])->can('view', 'customer');
        // Derechos RGPD (§3.10.1): solo owner y manager.
        Route::post('customers/{customer}/export', [CustomerController::class, 'export'])->can('manage', 'customer');
        Route::post('customers/{customer}/anonymize', [CustomerController::class, 'anonymize'])->can('manage', 'customer');

        // ───────── Taller: órdenes de trabajo ─────────
        Route::get('work-orders/{workOrder}', [WorkOrderController::class, 'show'])->can('view', 'workOrder');
        Route::patch('work-orders/{workOrder}', [WorkOrderController::class, 'update'])->can('operate', 'workOrder');
        Route::delete('work-orders/{workOrder}', [WorkOrderController::class, 'destroy'])->can('manage', 'workOrder');
        Route::post('work-orders/{workOrder}/status', [WorkOrderController::class, 'status'])->can('operate', 'workOrder');
    });
});
