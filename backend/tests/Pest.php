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

/**
 * Inicia sesión en la API (guard web, como Sanctum en modo SPA). El guard se indica siempre: tras la
 * primera petición, `auth:sanctum` deja `sanctum` como guard por defecto y `current_password:web`
 * (borrar la cuenta) no vería al usuario.
 */
function loginAs(User $user): void
{
    auth()->forgetGuards();
    test()->actingAs($user, 'web');
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

    // E16: el taller de Olga está en el directorio y ha recibido una solicitud de Pablo, un particular.
    listWorkshop($wws);
    $requester = makeUser('Pablo Particular');
    $rr = app(\App\Services\RepairRequestService::class)->create(
        $requester->personalWorkspace(), $requester, makeVehicle($requester->personalWorkspace(), ['plate' => '3333CCC']), $wws,
        ['title' => 'Ruido al frenar', 'description' => 'Chirrían los frenos delanteros.', 'preferred_date' => day(2), 'mileage' => 0, 'share_history' => true],
    );

    return (object) compact(
        'owner', 'mechanic', 'manager', 'pws', 'wws', 'vehicle', 'log', 'record', 'linked', 'expense',
        'reminder', 'document', 'customer', 'wvehicle', 'order', 'wexpense', 'requester', 'rr',
    );
}

// ───────────────────────── E16: directorio y solicitudes de reparación ─────────────────────────

/** Pone un taller en el directorio (perfil guardado con listed = true). */
function listWorkshop(Workspace $workshop, array $attributes = []): \App\Models\WorkshopProfile
{
    return \App\Models\WorkshopProfile::updateOrCreate(['workspace_id' => $workshop->id], array_merge([
        'listed' => true, 'city' => 'Lleida', 'address' => 'C/ Inventada, 1', 'phone' => '973 000 000',
        'services' => ['maintenance', 'brakes'], 'opening_hours' => 'L-V 8:00-14:00',
    ], $attributes));
}

/**
 * Mundo de E16: Lucía (particular) con un coche de 84.200 km; el taller de Marcos (owner) en el
 * directorio, con una gerente y un mecánico; y una intrusa con su propio garaje y su propio taller.
 */
function e16World(): object
{
    $owner = makeUser('Marcos Taller', 'Taller Destino');
    $wws = workshopOf($owner);
    $manager = addMember($wws, makeUser('Elena Gerente'), WorkspaceRole::Manager);
    $mechanic = addMember($wws, makeUser('Andrés Mecánico'), WorkspaceRole::Mechanic);
    listWorkshop($wws);

    $client = makeUser('Lucía Cliente');
    $pws = $client->personalWorkspace();
    $car = makeVehicle($pws, [
        'plate' => '1234ABC', 'color_hex' => '#C0392B', 'year' => 2019, 'nickname' => 'El rojo', 'vin' => 'VSSZZZKJZKR000001',
    ]);
    addReading($car, 84200, day(-3));

    $intruder = makeUser('Irene Intrusa', 'Taller Irene');

    return (object) compact('owner', 'wws', 'manager', 'mechanic', 'client', 'pws', 'car', 'intruder');
}

/** Cuerpo válido de `RepairRequestInput` para el coche de Lucía y el taller de Marcos. */
function requestInput(object $w, array $overrides = []): array
{
    return array_merge([
        'vehicle_id' => $w->car->id, 'workshop_id' => $w->wws->id, 'title' => 'Ruido al frenar',
        'description' => 'Chirrían los frenos delanteros al frenar suave.', 'zone' => 'brakes',
        'preferred_date' => day(3), 'mileage' => 84500, 'contact_phone' => '600 000 000', 'share_history' => false,
    ], $overrides);
}

/** Cuerpo válido de `RepairQuoteInput`: 2 líneas, 120,00 € + 21 % = 145,20 €. */
function quoteInput(array $overrides = []): array
{
    return array_merge([
        'items' => [
            ['kind' => 'part', 'name' => 'Pastillas delanteras', 'part_number' => 'PF-1', 'quantity' => '1', 'unit_price' => '80.00'],
            ['kind' => 'labor', 'name' => 'Mano de obra', 'quantity' => '1', 'unit_price' => '40.00'],
        ],
        'valid_days' => 15,
        'note' => 'Incluye revisión de discos.',
    ], $overrides);
}

/** Envía una solicitud por la API como Lucía y devuelve su id. */
function sendRequest(object $w, array $overrides = []): int
{
    loginAs($w->client);

    return test()->postJson("/api/v1/workspaces/{$w->pws->id}/repair-requests", requestInput($w, $overrides))
        ->assertCreated()
        ->json('data.id');
}
