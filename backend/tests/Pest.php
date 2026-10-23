<?php

use App\Enums\MileageSource;
use App\Enums\WorkspaceRole;
use App\Models\Document;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\Workspace;
use App\Services\AccountService;
use App\Services\CustomerService;
use App\Services\ExpenseService;
use App\Services\MaintenanceService;
use App\Services\MileageService;
use App\Services\ReminderService;
use App\Services\WorkOrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/*
|--------------------------------------------------------------------------
| Tests de CarCare (Pest 3, SQLite en memoria)
|--------------------------------------------------------------------------
*/

pest()->extend(Tests\TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

// ───────────────────────── Helpers ─────────────────────────

/** Usuario registrado como en la API (siempre con espacio personal; con taller si $workshop). */
function makeUser(string $name = 'Ana Prueba', ?string $workshop = null): User
{
    static $n = 0;
    $n++;

    return app(AccountService::class)->register([
        'name' => $name,
        'email' => 'usuario'.$n.'.'.Str::lower(Str::random(4)).'@prueba.test',
        'password' => 'password',
        'account_type' => $workshop ? 'workshop' : 'personal',
        'workshop_name' => $workshop,
    ]);
}

function workshopOf(User $user): Workspace
{
    return $user->workspaces()->where('type', 'workshop')->firstOrFail();
}

function addMember(Workspace $workspace, User $user, WorkspaceRole $role): User
{
    $workspace->members()->attach($user->id, ['role' => $role->value]);

    return $user;
}

/** Inicia sesión en la API (guard web, como Sanctum en modo SPA). */
function loginAs(User $user): void
{
    auth()->forgetGuards();
    test()->actingAs($user);
}

function makeVehicle(Workspace $workspace, array $attributes = []): Vehicle
{
    return Vehicle::create(array_merge([
        'workspace_id' => $workspace->id,
        'make' => 'Seat',
        'model' => 'Ibiza',
        'body_type' => 'hatchback',
        'fuel_type' => 'gasoline',
    ], $attributes));
}

/** Lectura de km directa (sin pasar por la API). */
function addReading(Vehicle $vehicle, int $km, string $date, MileageSource $source = MileageSource::Manual): void
{
    app(MileageService::class)->record($vehicle, $km, $date, $source, confirmed: true);
    $vehicle->refresh();
}

function makeDocument(Vehicle $vehicle, string $title = 'Factura'): Document
{
    $path = "documents/{$vehicle->workspace_id}/".Str::uuid().'.pdf';
    Storage::disk('local')->put($path, "%PDF-1.4\n%prueba\n");

    return $vehicle->documents()->create([
        'title' => $title, 'document_type' => 'invoice', 'disk' => 'local', 'path' => $path,
        'original_filename' => 'factura.pdf', 'mime_type' => 'application/pdf', 'size' => 17,
    ]);
}

function day(int $offset = 0): string
{
    return today()->addDays($offset)->toDateString();
}

/** '/workspaces/{pws}/…' → '/api/v1/workspaces/7/…' con los ids del mundo de prueba. */
function api(string $uri, ?object $world = null): string
{
    if ($world) {
        foreach ((array) $world as $key => $value) {
            if (is_object($value) && method_exists($value, 'getKey')) {
                $uri = str_replace('{'.$key.'}', (string) $value->getKey(), $uri);
            }
        }
    }

    return '/api/v1'.$uri;
}

/**
 * Mundo de prueba: Olga es owner de su espacio personal y de un taller (con un mecánico y un gerente).
 * Contiene al menos un recurso de cada tipo para recorrer todos los endpoints.
 */
function world(): object
{
    Storage::fake('local');

    $owner = makeUser('Olga Dueña', 'Taller Olga');
    $pws = $owner->personalWorkspace();
    $wws = workshopOf($owner);
    $mechanic = addMember($wws, makeUser('Mario Mecánico'), WorkspaceRole::Mechanic);
    $manager = addMember($wws, makeUser('Gema Gerente'), WorkspaceRole::Manager);

    $vehicle = makeVehicle($pws, ['plate' => '1111AAA']);
    app(MileageService::class)->record($vehicle, 1000, day(-10), MileageSource::Manual);
    $log = $vehicle->mileageLogs()->first();
    $record = app(MaintenanceService::class)->create($vehicle, [
        'type' => 'repair', 'zone' => 'engine', 'title' => 'Reparación', 'service_date' => day(-5), 'total_cost' => '50.00',
    ]);
    $linked = $record->expense;
    $expense = app(ExpenseService::class)->create($vehicle, ['category' => 'parking', 'amount' => '3.50', 'expense_date' => day()]);
    $reminder = app(ReminderService::class)->create($vehicle, ['title' => 'ITV', 'kind' => 'itv', 'due_date' => day(90)]);
    $document = makeDocument($vehicle);

    $customer = app(CustomerService::class)->create($wws, ['name' => 'Cliente Uno', 'phone' => '600 000 001']);
    $wvehicle = makeVehicle($wws, ['customer_id' => $customer->id, 'plate' => '2222BBB', 'body_type' => 'van']);
    $order = app(WorkOrderService::class)->create($wws, [
        'vehicle_id' => $wvehicle->id, 'title' => 'Cambio de aceite',
        'items' => [['kind' => 'labor', 'name' => 'Mano de obra', 'quantity' => '1', 'unit_price' => '40.00']],
    ]);
    $wexpense = app(ExpenseService::class)->create($wvehicle, ['category' => 'other', 'amount' => '10.00', 'expense_date' => day()]);

    return (object) compact(
        'owner', 'mechanic', 'manager', 'pws', 'wws', 'vehicle', 'log', 'record', 'linked', 'expense',
        'reminder', 'document', 'customer', 'wvehicle', 'order', 'wexpense',
    );
}
