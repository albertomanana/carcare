<?php

namespace Database\Seeders;

use App\Enums\MileageSource;
use App\Enums\ReminderStatus;
use App\Enums\WorkOrderStatus;
use App\Enums\WorkspaceRole;
use App\Models\Activity;
use App\Models\Customer;
use App\Models\Document;
use App\Models\Expense;
use App\Models\MaintenanceRecord;
use App\Models\MileageLog;
use App\Models\Reminder;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\WorkOrder;
use App\Models\Workspace;
use App\Services\AccountService;
use App\Services\MaintenanceService;
use App\Services\MileageService;
use App\Support\Km;
use App\Support\LineItems;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Datos de demostración (contrato §5). Todo es FICTICIO: personas, empresas, teléfonos
 * (600 000 0xx), emails (@ejemplo.test), NIF y matrículas están inventados.
 *
 *  - demo@carcare.test      → particular con 2 vehículos y ~18 meses de historial.
 *  - taller@carcare.test    → "Taller Demo" (owner) con 4 elevadores, ~12 clientes, ~20 vehículos y ~30 órdenes.
 *  - gerente@carcare.test   → manager del taller.
 *  - mecanico@carcare.test  → mechanic del taller.
 * Contraseña de todas: "password". Se puede ejecutar varias veces: borra antes la demo anterior.
 * Determinista (semilla fija) respecto a la fecha de hoy.
 */
class DemoSeeder extends Seeder
{
    public const PASSWORD = 'password';

    public const EMAILS = ['demo@carcare.test', 'taller@carcare.test', 'gerente@carcare.test', 'mecanico@carcare.test'];

    private CarbonImmutable $today;

    /** @var array<string, array<string, int>> km al final de cada día, por clave de vehículo */
    private array $odometers = [];

    /** @var list<array<string, mixed>> actividad pendiente de insertar (se ordena al final) */
    private array $activities = [];

    public function __construct(
        private readonly AccountService $accounts,
        private readonly MileageService $mileage,
        private readonly MaintenanceService $maintenance,
    ) {}

    public function run(): void
    {
        if (app()->environment('production')) {
            throw new RuntimeException('DemoSeeder no se ejecuta en producción: los datos de demostración son ficticios.');
        }

        mt_srand(20261022);
        $this->today = CarbonImmutable::today();

        $this->removePreviousDemo();

        Model::unguarded(function () {
            DB::transaction(function () {
                $this->seedPersonal();
                $this->seedWorkshop();
                $this->flushActivities();
            });
        });

        $this->command?->info('Demo lista: demo@carcare.test y taller@carcare.test (también gerente@ y mecanico@), contraseña "password".');
    }

    // ═══════════════════════════════ Utilidades ═══════════════════════════════

    private function removePreviousDemo(): void
    {
        User::query()->whereIn('email', self::EMAILS)->get()->each(fn (User $u) => $this->accounts->delete($u));
    }

    private function createUser(string $name, string $email, string $type, ?string $workshopName = null, int $daysAgo = 560): User
    {
        $user = $this->accounts->register([
            'name' => $name,
            'email' => $email,
            'password' => self::PASSWORD,
            'account_type' => $type,
            'workshop_name' => $workshopName,
        ]);
        $created = $this->today->subDays($daysAgo)->setTime(10, 0);
        $user->forceFill(['created_at' => $created, 'updated_at' => $created, 'email_verified_at' => $created])->save();
        $user->workspaces()->each(fn (Workspace $w) => $w->forceFill(['created_at' => $created, 'updated_at' => $created])->save());
        DB::table('workspace_user')->where('user_id', $user->id)->update(['created_at' => $created, 'updated_at' => $created]);

        return $user;
    }

    private function rand(float $min, float $max, int $decimals = 2): string
    {
        $factor = 10 ** $decimals;

        return number_format(mt_rand((int) round($min * $factor), (int) round($max * $factor)) / $factor, $decimals, '.', '');
    }

    /** Odómetro diario simulado: entre semana trayectos cortos; algunos fines de semana, viaje. */
    private function simulateOdometer(string $key, CarbonImmutable $start, int $startKm, array $weekday, int $tripChance): void
    {
        $km = $startKm;
        $days = [];
        for ($d = $start; $d <= $this->today; $d = $d->addDay()) {
            if ($d > $start) {
                $km += $d->isWeekend()
                    ? (mt_rand(1, 100) <= $tripChance ? mt_rand(110, 330) : mt_rand(0, 25))
                    : mt_rand($weekday[0], $weekday[1]);
            }
            $days[$d->toDateString()] = $km;
        }
        $this->odometers[$key] = $days;
    }

    private function odo(string $key, CarbonImmutable $date): int
    {
        return $this->odometers[$key][$date->toDateString()];
    }

    /** Último día cuyo odómetro no supera $km. */
    private function dayAtKm(string $key, int $km): CarbonImmutable
    {
        $found = array_key_first($this->odometers[$key]);
        foreach ($this->odometers[$key] as $date => $value) {
            if ($value > $km) {
                break;
            }
            $found = $date;
        }

        return CarbonImmutable::parse($found);
    }

    private function log(Vehicle $vehicle, CarbonImmutable $date, int $km, MileageSource $source, ?int $sourceId = null, ?string $note = null): MileageLog
    {
        $at = $date->setTime(20, mt_rand(0, 59));

        return MileageLog::create([
            'vehicle_id' => $vehicle->id,
            'recorded_at' => $date->toDateString(),
            'mileage' => $km,
            'source' => $source,
            'source_id' => $sourceId,
            'note' => $note,
            'created_at' => $at,
            'updated_at' => $at,
        ]);
    }

    private function activity(Workspace $ws, ?User $user, ?Vehicle $vehicle, string $action, string $entityType, int $entityId, string $summary, CarbonImmutable $at, array $meta = []): void
    {
        $this->activities[] = [
            'workspace_id' => $ws->id,
            'user_id' => $user?->id,
            'vehicle_id' => $vehicle?->id,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'summary' => mb_substr($summary, 0, 255),
            'metadata' => $meta === [] ? null : json_encode($meta),
            'created_at' => $at,
        ];
    }

    private function flushActivities(): void
    {
        usort($this->activities, fn ($a, $b) => $a['created_at'] <=> $b['created_at']);
        foreach (array_chunk($this->activities, 200) as $chunk) {
            Activity::insert(array_map(fn ($row) => ['created_at' => $row['created_at']->toDateTimeString()] + $row, $chunk));
        }
    }

    // ═══════════════════════════════ Particular ═══════════════════════════════

    private function seedPersonal(): void
    {
        $user = $this->createUser('Lucía Demo', 'demo@carcare.test', 'personal', daysAgo: 560);
        $ws = $user->personalWorkspace();
        Storage::disk('local')->deleteDirectory("documents/{$ws->id}");

        $start = $this->today->subMonths(18);

        // ─── Hatchback rojo (gasolina) ───
        $ibiza = Vehicle::create([
            'workspace_id' => $ws->id, 'nickname' => 'El rojo', 'make' => 'Seat', 'model' => 'Ibiza',
            'version' => '1.0 TSI FR', 'year' => 2019, 'fuel_type' => 'gasoline', 'transmission' => 'manual',
            'engine' => '1.0 TSI 110 CV', 'body_type' => 'hatchback', 'color_hex' => '#C62828', 'plate' => '4821KTB',
            'vin' => 'VSSZZZKJZKR000001', 'purchase_date' => '2019-06-14', 'purchase_mileage' => 12,
            'created_at' => $start->setTime(18, 30), 'updated_at' => $start->setTime(18, 30),
        ]);
        $this->simulateOdometer('ibiza', $start, 52340, [18, 52], 38);

        // ─── SUV gris (diésel, automático) ───
        $sportage = Vehicle::create([
            'workspace_id' => $ws->id, 'nickname' => null, 'make' => 'Kia', 'model' => 'Sportage',
            'version' => '1.6 CRDi Drive', 'year' => 2021, 'fuel_type' => 'diesel', 'transmission' => 'automatic',
            'engine' => '1.6 CRDi 136 CV', 'body_type' => 'suv', 'color_hex' => '#6B7280', 'plate' => '7310LFW',
            'vin' => null, 'purchase_date' => '2021-03-02', 'purchase_mileage' => 0,
            'created_at' => $start->setTime(19, 5), 'updated_at' => $start->setTime(19, 5),
        ]);
        $this->simulateOdometer('sportage', $start, 30215, [20, 46], 28);

        foreach ([['ibiza', $ibiza], ['sportage', $sportage]] as [$key, $vehicle]) {
            $this->log($vehicle, $start, $this->odo($key, $start), MileageSource::VehicleCreated, $vehicle->id);
            $this->activity($ws, $user, $vehicle, 'vehicle.created', 'vehicle', $vehicle->id, "Lucía Demo añadió el vehículo {$vehicle->displayName()}", $start->setTime(18, 31));
            $this->weeklyReadings($ws, $user, $key, $vehicle, $start);
        }

        $this->fuel($ws, $user, 'ibiza', $ibiza, $start, unit: 'l', consumption: 6.1, price: [1.52, 1.71], every: [470, 610], station: ['Repsol', 'Cepsa', 'BP', 'Galp', 'Gasolinera Ejemplo']);
        $this->fuel($ws, $user, 'sportage', $sportage, $start, unit: 'l', consumption: 6.6, price: [1.43, 1.61], every: [560, 760], station: ['Repsol', 'Shell', 'Gasolinera Ejemplo', 'Ballenoil']);

        $ibizaRecords = $this->personalRecords($ws, $user, 'ibiza', $ibiza, $this->ibizaRecords());
        $sportageRecords = $this->personalRecords($ws, $user, 'sportage', $sportage, $this->sportageRecords());

        $this->miscExpenses($ws, $user, $ibiza, $start, insurance: '389.40', insuranceDueIn: 18, tax: '68.16');
        $this->miscExpenses($ws, $user, $sportage, $start, insurance: '512.75', insuranceDueIn: 140, tax: '115.20');

        $this->ibizaReminders($ws, $user, $ibiza, $ibizaRecords);
        $this->sportageReminders($ws, $user, $sportage, $sportageRecords);

        $this->personalDocuments($ws, $user, $ibiza, $sportage, $ibizaRecords);

        $this->mileage->recalculate($ibiza);
        $this->mileage->recalculate($sportage);
    }

    /** Lectura manual cada domingo y otra hoy. */
    private function weeklyReadings(Workspace $ws, User $user, string $key, Vehicle $vehicle, CarbonImmutable $start): void
    {
        $notes = ['Antes del viaje', 'Vuelta de vacaciones', null, null, null, null, null, null];
        for ($d = $start->next(CarbonImmutable::SUNDAY); $d < $this->today; $d = $d->addWeek()) {
            $km = $this->odo($key, $d);
            $log = $this->log($vehicle, $d, $km, MileageSource::Manual, note: $notes[mt_rand(0, count($notes) - 1)]);
            if ($d >= $this->today->subDays(45)) {
                $this->activity($ws, $user, $vehicle, 'mileage.recorded', 'mileage_log', $log->id,
                    'Lucía Demo registró '.Km::human($km).' en '.$vehicle->displayName(), $d->setTime(21, 10), ['mileage' => $km]);
            }
        }
        $km = $this->odo($key, $this->today);
        $log = $this->log($vehicle, $this->today, $km, MileageSource::Manual, note: 'Lectura de hoy');
        $this->activity($ws, $user, $vehicle, 'mileage.recorded', 'mileage_log', $log->id,
            'Lucía Demo registró '.Km::human($km).' en '.$vehicle->displayName(), $this->today->setTime(8, 5), ['mileage' => $km]);
    }

    /** Repostajes con depósito lleno (y alguno parcial) para que el consumo lleno-a-lleno sea calculable. */
    private function fuel(Workspace $ws, User $user, string $key, Vehicle $vehicle, CarbonImmutable $start, string $unit, float $consumption, array $price, array $every, array $station): void
    {
        $lastFillKm = $this->odo($key, $start);
        $consumed = 0.0;
        $partials = 0.0;
        $threshold = mt_rand($every[0], $every[1]);
        $previousKm = $lastFillKm;

        for ($d = $start->addDay(); $d <= $this->today->subDay(); $d = $d->addDay()) {
            $km = $this->odo($key, $d);
            $consumed += ($km - $previousKm) * $consumption * (mt_rand(92, 109) / 100) / 100;
            $previousKm = $km;

            if ($km - $lastFillKm < $threshold) {
                continue;
            }

            $full = mt_rand(1, 7) !== 1;
            $liters = $full ? max(8.0, $consumed - $partials) : (float) mt_rand(15, 22);
            $liters = round($liters, 2);
            $unitPrice = (float) $this->rand($price[0], $price[1], 3);
            $amount = Money::format((int) round($liters * $unitPrice * 100));

            $expense = Expense::create([
                'vehicle_id' => $vehicle->id, 'category' => 'fuel',
                'description' => $station[mt_rand(0, count($station) - 1)].' · '.number_format($unitPrice, 3, ',', '').' €/l',
                'amount' => $amount, 'currency' => 'EUR', 'expense_date' => $d->toDateString(), 'mileage' => $km,
                'fuel_quantity' => number_format($liters, 2, '.', ''), 'fuel_unit' => $unit, 'full_tank' => $full,
                'created_at' => $d->setTime(19, 40), 'updated_at' => $d->setTime(19, 40),
            ]);
            $this->log($vehicle, $d, $km, MileageSource::Expense, $expense->id);

            if ($d >= $this->today->subDays(45)) {
                $this->activity($ws, $user, $vehicle, 'expense.created', 'expense', $expense->id,
                    'Lucía Demo añadió un gasto de '.Money::human($amount).' (Combustible) en '.$vehicle->displayName(),
                    $d->setTime(19, 41), ['category' => 'fuel', 'amount' => $amount]);
            }

            if ($full) {
                $consumed = 0.0;
                $partials = 0.0;
                $lastFillKm = $km;
                $threshold = mt_rand($every[0], $every[1]);
            } else {
                $partials += $liters;
                $lastFillKm = $km;
                $threshold = mt_rand(150, 300);
            }
        }
    }

    /**
     * Intervenciones de un vehículo personal. Cada una con km del odómetro, líneas y gasto vinculado (D3-A).
     *
     * @return array<string, MaintenanceRecord>
     */
    private function personalRecords(Workspace $ws, User $user, string $key, Vehicle $vehicle, array $specs): array
    {
        $records = [];
        foreach ($specs as $ref => $spec) {
            $date = $spec['date'];
            $km = $this->odo($key, $date);
            $rows = LineItems::rows($spec['items']);
            $total = LineItems::sumCents($rows);

            $record = MaintenanceRecord::create([
                'vehicle_id' => $vehicle->id, 'type' => $spec['type'], 'zone' => $spec['zone'],
                'service_kind' => $spec['kind'] ?? null, 'title' => $spec['title'], 'description' => $spec['description'] ?? null,
                'service_date' => $date->toDateString(), 'mileage' => $km, 'workshop_name' => $spec['workshop'] ?? null,
                'parts_cost' => Money::format(LineItems::sumCents(array_filter($rows, fn ($r) => $r['kind'] !== 'labor')) ?? 0),
                'labor_cost' => Money::format(LineItems::sumCents(array_filter($rows, fn ($r) => $r['kind'] === 'labor')) ?? 0),
                'total_cost' => $total === null ? null : Money::format($total), 'currency' => 'EUR',
                'archived_at' => ($spec['archived'] ?? false) ? $date->addDays(2)->setTime(10, 0) : null,
                'created_at' => $date->setTime(17, 15), 'updated_at' => $date->setTime(17, 15),
            ]);
            $record->items()->createMany($rows);
            $record->setRelation('vehicle', $vehicle);
            $this->maintenance->syncLinkedExpense($record);
            Expense::query()->where('maintenance_record_id', $record->id)->update(['created_at' => $date->setTime(17, 15), 'updated_at' => $date->setTime(17, 15)]);

            if (! ($spec['archived'] ?? false)) {
                $this->log($vehicle, $date, $km, MileageSource::Maintenance, $record->id);
            }
            if ($date >= $this->today->subDays(60)) {
                $this->activity($ws, $user, $vehicle, 'maintenance.created', 'maintenance_record', $record->id,
                    "Lucía Demo registró la intervención «{$record->title}» en ".$vehicle->displayName(), $date->setTime(17, 16),
                    ['type' => $spec['type'], 'zone' => $spec['zone']]);
            }
            $records[$ref] = $record;
        }

        return $records;
    }

    private function ibizaRecords(): array
    {
        // El cambio de aceite queda ~15.400 km atrás: su recordatorio (cada 15.000 km) sale VENCIDO por km.
        $oilDate = $this->dayAtKm('ibiza', $this->odo('ibiza', $this->today) - 15420);

        return [
            'service' => [
                'date' => $this->today->subDays(468), 'type' => 'maintenance', 'zone' => 'engine', 'kind' => 'service',
                'title' => 'Revisión de los 60.000 km', 'workshop' => 'AutoServicio Ejemplo',
                'description' => 'Revisión según plan del fabricante. Sin incidencias.',
                'items' => [
                    ['kind' => 'fluid', 'name' => 'Aceite 5W-30 (litros)', 'part_number' => null, 'quantity' => '4.20', 'unit_price' => '9.80'],
                    ['kind' => 'part', 'name' => 'Filtro de aceite', 'part_number' => 'FO-1042', 'quantity' => '1', 'unit_price' => '12.50'],
                    ['kind' => 'part', 'name' => 'Filtro de aire', 'part_number' => 'FA-2210', 'quantity' => '1', 'unit_price' => '18.90'],
                    ['kind' => 'part', 'name' => 'Filtro de habitáculo', 'part_number' => 'FH-0871', 'quantity' => '1', 'unit_price' => '16.40'],
                    ['kind' => 'labor', 'name' => 'Mano de obra', 'part_number' => null, 'quantity' => '1.50', 'unit_price' => '45.00'],
                ],
            ],
            'oil' => [
                'date' => $oilDate, 'type' => 'maintenance', 'zone' => 'engine', 'kind' => 'oil',
                'title' => 'Cambio de aceite y filtro', 'workshop' => 'AutoServicio Ejemplo',
                'items' => [
                    ['kind' => 'fluid', 'name' => 'Aceite 5W-30 (litros)', 'part_number' => null, 'quantity' => '4.20', 'unit_price' => '10.20'],
                    ['kind' => 'part', 'name' => 'Filtro de aceite', 'part_number' => 'FO-1042', 'quantity' => '1', 'unit_price' => '12.90'],
                    ['kind' => 'labor', 'name' => 'Mano de obra', 'part_number' => null, 'quantity' => '0.50', 'unit_price' => '45.00'],
                ],
            ],
            'itv' => [
                'date' => $this->today->subDays(305), 'type' => 'inspection', 'zone' => 'general', 'kind' => 'itv',
                'title' => 'ITV periódica (favorable)', 'workshop' => 'Estación ITV Ejemplo',
                'items' => [['kind' => 'other', 'name' => 'Tasa de inspección', 'part_number' => null, 'quantity' => '1', 'unit_price' => '45.50']],
            ],
            'brakes' => [
                'date' => $this->today->subDays(248), 'type' => 'maintenance', 'zone' => 'brakes', 'kind' => 'brakes',
                'title' => 'Pastillas de freno delanteras', 'workshop' => 'Taller Demo Norte',
                'description' => 'Pastillas al 15 %. Discos dentro de tolerancia.',
                'items' => [
                    ['kind' => 'part', 'name' => 'Juego de pastillas delanteras', 'part_number' => 'PF-3302', 'quantity' => '1', 'unit_price' => '42.60'],
                    ['kind' => 'fluid', 'name' => 'Líquido de frenos DOT 4 (litros)', 'part_number' => null, 'quantity' => '0.50', 'unit_price' => '14.00'],
                    ['kind' => 'labor', 'name' => 'Mano de obra', 'part_number' => null, 'quantity' => '1', 'unit_price' => '45.00'],
                ],
            ],
            'ac' => [
                'date' => $this->today->subDays(176), 'type' => 'maintenance', 'zone' => 'interior', 'kind' => 'ac',
                'title' => 'Recarga del aire acondicionado', 'workshop' => 'Taller Demo Norte',
                'items' => [
                    ['kind' => 'fluid', 'name' => 'Gas R1234yf (kg)', 'part_number' => null, 'quantity' => '0.45', 'unit_price' => '98.00'],
                    ['kind' => 'labor', 'name' => 'Comprobación de fugas y carga', 'part_number' => null, 'quantity' => '1', 'unit_price' => '35.00'],
                ],
            ],
            'ac_dup' => [
                'date' => $this->today->subDays(175), 'type' => 'maintenance', 'zone' => 'interior', 'kind' => 'ac',
                'title' => 'Recarga del aire acondicionado (duplicado)', 'workshop' => 'Taller Demo Norte', 'archived' => true,
                'items' => [['kind' => 'labor', 'name' => 'Comprobación de fugas y carga', 'part_number' => null, 'quantity' => '1', 'unit_price' => '35.00']],
            ],
            'body' => [
                'date' => $this->today->subDays(118), 'type' => 'bodywork', 'zone' => 'body', 'kind' => null,
                'title' => 'Arañazo en el paragolpes trasero', 'workshop' => 'Chapa y Pintura Muestra',
                'description' => 'Lijado, imprimación y pintura del paragolpes.',
                'items' => [
                    ['kind' => 'part', 'name' => 'Pintura y barniz', 'part_number' => null, 'quantity' => '1', 'unit_price' => '64.00'],
                    ['kind' => 'labor', 'name' => 'Chapa y pintura', 'part_number' => null, 'quantity' => '3', 'unit_price' => '42.00'],
                ],
            ],
            'tyres' => [
                'date' => $this->today->subDays(64), 'type' => 'tyres', 'zone' => 'tyres', 'kind' => 'tyres',
                'title' => 'Neumáticos delanteros nuevos', 'workshop' => 'Neumáticos Muestra',
                'items' => [
                    ['kind' => 'part', 'name' => 'Neumático 215/45 R16', 'part_number' => null, 'quantity' => '2', 'unit_price' => '89.90'],
                    ['kind' => 'labor', 'name' => 'Montaje y equilibrado', 'part_number' => null, 'quantity' => '2', 'unit_price' => '12.00'],
                    ['kind' => 'other', 'name' => 'Ecotasa', 'part_number' => null, 'quantity' => '2', 'unit_price' => '1.45'],
                ],
            ],
            'battery' => [
                'date' => $this->today->subDays(19), 'type' => 'repair', 'zone' => 'electrical', 'kind' => 'battery',
                'title' => 'Cambio de batería', 'workshop' => 'AutoServicio Ejemplo',
                'description' => 'No arrancaba en frío. Batería original agotada.',
                'items' => [
                    ['kind' => 'part', 'name' => 'Batería 60 Ah 540 A', 'part_number' => 'BT-60540', 'quantity' => '1', 'unit_price' => '109.90'],
                    ['kind' => 'labor', 'name' => 'Sustitución y registro', 'part_number' => null, 'quantity' => '0.30', 'unit_price' => '45.00'],
                ],
            ],
        ];
    }

    private function sportageRecords(): array
    {
        // Último aceite hace ~9.300 km: su recordatorio (cada 10.000 km) queda PRÓXIMO.
        $oilDate = $this->dayAtKm('sportage', $this->odo('sportage', $this->today) - 9300);

        return [
            'service' => [
                'date' => $this->today->subDays(430), 'type' => 'maintenance', 'zone' => 'engine', 'kind' => 'service',
                'title' => 'Revisión oficial 30.000 km', 'workshop' => 'Concesionario Ejemplo',
                'items' => [
                    ['kind' => 'fluid', 'name' => 'Aceite 0W-30 (litros)', 'part_number' => null, 'quantity' => '5.30', 'unit_price' => '11.40'],
                    ['kind' => 'part', 'name' => 'Filtro de aceite', 'part_number' => 'FO-2620', 'quantity' => '1', 'unit_price' => '14.20'],
                    ['kind' => 'part', 'name' => 'Filtro de combustible', 'part_number' => 'FC-0411', 'quantity' => '1', 'unit_price' => '38.70'],
                    ['kind' => 'labor', 'name' => 'Mano de obra', 'part_number' => null, 'quantity' => '2', 'unit_price' => '52.00'],
                ],
            ],
            'itv' => [
                'date' => $this->today->subDays(392), 'type' => 'inspection', 'zone' => 'general', 'kind' => 'itv',
                'title' => 'Primera ITV (favorable)', 'workshop' => 'Estación ITV Ejemplo',
                'items' => [['kind' => 'other', 'name' => 'Tasa de inspección', 'part_number' => null, 'quantity' => '1', 'unit_price' => '47.20']],
            ],
            'exhaust' => [
                'date' => $this->today->subDays(272), 'type' => 'repair', 'zone' => 'exhaust', 'kind' => null,
                'title' => 'Abrazadera del escape suelta', 'workshop' => 'Taller Demo Norte',
                'items' => [
                    ['kind' => 'part', 'name' => 'Abrazadera de escape', 'part_number' => 'AE-55', 'quantity' => '2', 'unit_price' => '6.80'],
                    ['kind' => 'labor', 'name' => 'Mano de obra', 'part_number' => null, 'quantity' => '0.50', 'unit_price' => '45.00'],
                ],
            ],
            'oil' => [
                'date' => $oilDate, 'type' => 'maintenance', 'zone' => 'engine', 'kind' => 'oil',
                'title' => 'Cambio de aceite y filtros', 'workshop' => 'Concesionario Ejemplo',
                'items' => [
                    ['kind' => 'fluid', 'name' => 'Aceite 0W-30 (litros)', 'part_number' => null, 'quantity' => '5.30', 'unit_price' => '11.40'],
                    ['kind' => 'part', 'name' => 'Filtro de aceite', 'part_number' => 'FO-2620', 'quantity' => '1', 'unit_price' => '14.20'],
                    ['kind' => 'labor', 'name' => 'Mano de obra', 'part_number' => null, 'quantity' => '0.80', 'unit_price' => '52.00'],
                ],
            ],
            'breakdown' => [
                'date' => $this->today->subDays(150), 'type' => 'breakdown', 'zone' => 'electrical', 'kind' => null,
                'title' => 'Avería: sensor de aparcamiento trasero', 'workshop' => 'Taller Demo Norte',
                'description' => 'Pitido continuo al meter la marcha atrás. Sensor central sustituido.',
                'items' => [
                    ['kind' => 'part', 'name' => 'Sensor de aparcamiento', 'part_number' => 'SP-9031', 'quantity' => '1', 'unit_price' => '58.30'],
                    ['kind' => 'labor', 'name' => 'Diagnosis y sustitución', 'part_number' => null, 'quantity' => '1', 'unit_price' => '45.00'],
                ],
            ],
            'alignment' => [
                'date' => $this->today->subDays(96), 'type' => 'maintenance', 'zone' => 'suspension', 'kind' => null,
                'title' => 'Alineación de la dirección', 'workshop' => 'Neumáticos Muestra',
                'items' => [['kind' => 'labor', 'name' => 'Alineación 3D', 'part_number' => null, 'quantity' => '1', 'unit_price' => '39.00']],
            ],
            'gearbox' => [
                'date' => $this->today->subDays(33), 'type' => 'maintenance', 'zone' => 'transmission', 'kind' => 'other',
                'title' => 'Cambio de aceite del cambio automático', 'workshop' => 'Concesionario Ejemplo',
                'items' => [
                    ['kind' => 'fluid', 'name' => 'Aceite ATF (litros)', 'part_number' => null, 'quantity' => '6', 'unit_price' => '14.90'],
                    ['kind' => 'labor', 'name' => 'Mano de obra', 'part_number' => null, 'quantity' => '1.20', 'unit_price' => '52.00'],
                ],
            ],
        ];
    }

    /** Seguro, impuesto, aparcamiento, peajes, lavados y alguna multa. */
    private function miscExpenses(Workspace $ws, User $user, Vehicle $vehicle, CarbonImmutable $start, string $insurance, int $insuranceDueIn, string $tax): void
    {
        $rows = [];

        // Seguro anual: la última renovación fue hace (12 meses − días hasta el vencimiento).
        $renewal = $this->today->addDays($insuranceDueIn)->subYear();
        foreach ([$renewal->subYear(), $renewal] as $date) {
            if ($date >= $start) {
                $rows[] = [$date, 'insurance', 'Seguro anual (póliza ficticia)', $insurance];
            }
        }

        // Impuesto de circulación cada abril.
        for ($year = $start->year; $year <= $this->today->year; $year++) {
            $date = CarbonImmutable::create($year, 4, 20);
            if ($date >= $start && $date <= $this->today) {
                $rows[] = [$date, 'tax', 'Impuesto de circulación '.$year, $tax];
            }
        }

        for ($d = $start->addDays(3); $d <= $this->today; $d = $d->addDays(mt_rand(6, 16))) {
            $roll = mt_rand(1, 100);
            $rows[] = match (true) {
                $roll <= 45 => [$d, 'parking', mt_rand(0, 1) ? 'Parking del centro' : 'Zona azul', $this->rand(1.8, 14.5)],
                $roll <= 70 => [$d, 'cleaning', mt_rand(0, 1) ? 'Lavado exterior' : 'Lavado completo', $this->rand(6.0, 18.0)],
                $roll <= 92 => [$d, 'tolls', 'Peaje autopista', $this->rand(4.2, 21.6)],
                default => [$d, 'other', mt_rand(0, 1) ? 'Alfombrillas y ambientador' : 'Líquido limpiaparabrisas', $this->rand(4.5, 29.9)],
            };
        }

        if ($vehicle->make === 'Seat') {
            $rows[] = [$this->today->subDays(201), 'fines', 'Multa de aparcamiento (ejemplo)', '90.00'];
        }

        foreach ($rows as [$date, $category, $description, $amount]) {
            $expense = Expense::create([
                'vehicle_id' => $vehicle->id, 'category' => $category, 'description' => $description,
                'amount' => $amount, 'currency' => 'EUR', 'expense_date' => $date->toDateString(),
                'created_at' => $date->setTime(13, 20), 'updated_at' => $date->setTime(13, 20),
            ]);
            if ($date >= $this->today->subDays(45)) {
                $this->activity($ws, $user, $vehicle, 'expense.created', 'expense', $expense->id,
                    'Lucía Demo añadió un gasto de '.Money::human($amount).' ('.$expense->category->label().') en '.$vehicle->displayName(),
                    $date->setTime(13, 21), ['category' => $category, 'amount' => $amount]);
            }
        }
    }

    private function reminder(Vehicle $vehicle, array $data): Reminder
    {
        return Reminder::create($data + [
            'vehicle_id' => $vehicle->id,
            'status' => ReminderStatus::Pending,
            'created_at' => CarbonImmutable::parse($data['starts_on'])->setTime(9, 0),
            'updated_at' => CarbonImmutable::parse($data['starts_on'])->setTime(9, 0),
        ]);
    }

    /** @param array<string, MaintenanceRecord> $records */
    private function ibizaReminders(Workspace $ws, User $user, Vehicle $v, array $records): void
    {
        $oil = $records['oil'];
        $itv = $records['itv'];
        $tyres = $records['tyres'];
        $brakes = $records['brakes'];
        $battery = $records['battery'];
        $insuranceStart = $this->today->addDays(18)->subYear();

        // Vencido: aceite (por km).
        $this->reminder($v, [
            'title' => 'Cambio de aceite', 'kind' => 'oil', 'zone' => 'engine',
            'due_date' => $oil->service_date->addYear()->toDateString(), 'due_mileage' => $oil->mileage + 15000,
            'recurrence_months' => 12, 'recurrence_km' => 15000,
            'starts_on' => $oil->service_date->toDateString(), 'start_mileage' => $oil->mileage,
        ]);
        // Hecho: el aceite anterior.
        $this->reminder($v, [
            'title' => 'Cambio de aceite', 'kind' => 'oil', 'zone' => 'engine',
            'due_date' => $records['service']->service_date->addYear()->toDateString(), 'due_mileage' => $records['service']->mileage + 15000,
            'recurrence_months' => 12, 'recurrence_km' => 15000,
            'starts_on' => $records['service']->service_date->toDateString(), 'start_mileage' => $records['service']->mileage,
            'status' => ReminderStatus::Done, 'completed_at' => $oil->service_date->toDateString(), 'completed_mileage' => $oil->mileage,
        ]);
        // Próximo: seguro (vence en 18 días).
        $this->reminder($v, [
            'title' => 'Renovar el seguro', 'kind' => 'insurance', 'zone' => 'general', 'notes' => 'Comparar al menos dos ofertas antes de renovar.',
            'due_date' => $this->today->addDays(18)->toDateString(), 'recurrence_months' => 12,
            'starts_on' => $insuranceStart->toDateString(),
        ]);
        // Al día.
        $this->reminder($v, [
            'title' => 'ITV', 'kind' => 'itv', 'zone' => 'general',
            'due_date' => $itv->service_date->addMonths(24)->toDateString(), 'recurrence_months' => 24,
            'starts_on' => $itv->service_date->toDateString(),
        ]);
        $this->reminder($v, [
            'title' => 'Revisar neumáticos', 'kind' => 'tyres', 'zone' => 'tyres',
            'due_mileage' => $tyres->mileage + 40000, 'recurrence_km' => 40000,
            'starts_on' => $tyres->service_date->toDateString(), 'start_mileage' => $tyres->mileage,
        ]);
        $this->reminder($v, [
            'title' => 'Pastillas de freno', 'kind' => 'brakes', 'zone' => 'brakes',
            'due_date' => $brakes->service_date->addMonths(30)->toDateString(), 'due_mileage' => $brakes->mileage + 35000,
            'starts_on' => $brakes->service_date->toDateString(), 'start_mileage' => $brakes->mileage,
        ]);
        $batteryReminder = $this->reminder($v, [
            'title' => 'Revisar la batería', 'kind' => 'battery', 'zone' => 'electrical',
            'due_date' => $battery->service_date->addYears(4)->toDateString(),
            'starts_on' => $battery->service_date->toDateString(),
        ]);
        $nextTax = CarbonImmutable::create($this->today->month > 4 ? $this->today->year + 1 : $this->today->year, 4, 30);
        $this->reminder($v, [
            'title' => 'Impuesto de circulación', 'kind' => 'tax', 'zone' => 'general',
            'due_date' => $nextTax->toDateString(), 'recurrence_months' => 12,
            'starts_on' => $nextTax->subYear()->toDateString(),
        ]);
        // Descartado.
        $this->reminder($v, [
            'title' => 'Cambiar escobillas', 'kind' => 'custom', 'zone' => 'body',
            'due_date' => $this->today->subDays(40)->toDateString(),
            'starts_on' => $this->today->subDays(160)->toDateString(), 'status' => ReminderStatus::Dismissed,
        ]);

        $this->activity($ws, $user, $v, 'reminder.created', 'reminder', $batteryReminder->id, "Lucía Demo creó el recordatorio «Revisar la batería» para {$v->displayName()}", $battery->service_date->setTime(17, 30));
    }

    /** @param array<string, MaintenanceRecord> $records */
    private function sportageReminders(Workspace $ws, User $user, Vehicle $v, array $records): void
    {
        $oil = $records['oil'];
        $itv = $records['itv'];

        // Próximo: aceite (quedan < 1.000 km).
        $this->reminder($v, [
            'title' => 'Cambio de aceite y filtros', 'kind' => 'oil', 'zone' => 'engine',
            'due_date' => $oil->service_date->addYear()->toDateString(), 'due_mileage' => $oil->mileage + 10000,
            'recurrence_months' => 12, 'recurrence_km' => 10000,
            'starts_on' => $oil->service_date->toDateString(), 'start_mileage' => $oil->mileage,
        ]);
        $this->reminder($v, [
            'title' => 'Correa de distribución', 'kind' => 'timing_belt', 'zone' => 'engine',
            'notes' => 'Según el plan de mantenimiento del manual.', 'due_mileage' => 120000,
            'starts_on' => '2021-03-02', 'start_mileage' => 0,
        ]);
        $this->reminder($v, [
            'title' => 'ITV', 'kind' => 'itv', 'zone' => 'general',
            'due_date' => $itv->service_date->addMonths(24)->toDateString(), 'recurrence_months' => 24,
            'starts_on' => $itv->service_date->toDateString(),
        ]);
        $this->reminder($v, [
            'title' => 'Renovar el seguro', 'kind' => 'insurance', 'zone' => 'general',
            'due_date' => $this->today->addDays(140)->toDateString(), 'recurrence_months' => 12,
            'starts_on' => $this->today->addDays(140)->subYear()->toDateString(),
        ]);
        $this->reminder($v, [
            'title' => 'Revisión anual', 'kind' => 'service', 'zone' => 'general',
            'due_date' => $records['service']->service_date->addYear()->toDateString(), 'recurrence_months' => 12,
            'starts_on' => $records['service']->service_date->toDateString(),
            'status' => ReminderStatus::Done, 'completed_at' => $oil->service_date->toDateString(), 'completed_mileage' => $oil->mileage,
        ]);
    }

    /** @param array<string, MaintenanceRecord> $ibizaRecords */
    private function personalDocuments(Workspace $ws, User $user, Vehicle $ibiza, Vehicle $sportage, array $ibizaRecords): void
    {
        $docs = [
            [$ibiza, 'Póliza del seguro (ejemplo)', 'insurance', 'poliza-seguro-ejemplo.pdf', null, $this->today->addDays(18), $this->today->addDays(18)->subYear()],
            [$ibiza, 'Factura del cambio de batería', 'invoice', 'factura-bateria.pdf', $ibizaRecords['battery'], null, $ibizaRecords['battery']->service_date],
            [$ibiza, 'Informe ITV', 'itv', 'informe-itv.pdf', $ibizaRecords['itv'], null, $ibizaRecords['itv']->service_date],
            [$ibiza, 'Foto del arañazo', 'photo', 'foto-aranazo.png', $ibizaRecords['body'], null, $ibizaRecords['body']->service_date],
            [$sportage, 'Permiso de circulación (copia)', 'registration', 'permiso-circulacion.pdf', null, null, $this->today->subDays(520)],
            [$sportage, 'Manual de mantenimiento', 'manual', 'manual-mantenimiento.pdf', null, null, $this->today->subDays(6)],
        ];

        foreach ($docs as [$vehicle, $title, $type, $filename, $record, $expires, $date]) {
            $date = $date instanceof CarbonImmutable ? $date : CarbonImmutable::parse($date);
            $document = $this->storeDocument($ws, $vehicle, $title, $type, $filename, $record, $expires, $date->setTime(18, 0), [
                'Documento de demostración generado por CarCare.',
                'Todos los datos son ficticios.',
                'Vehículo: '.$vehicle->displayName().' ('.$vehicle->plate.')',
            ]);
            if ($date >= $this->today->subDays(45)) {
                $this->activity($ws, $user, $vehicle, 'document.uploaded', 'document', $document->id,
                    "Lucía Demo subió el documento «{$title}» a ".$vehicle->displayName(), $date->setTime(18, 1), ['document_type' => $type]);
            }
        }
    }

    private function storeDocument(Workspace $ws, Vehicle $vehicle, string $title, string $type, string $filename, ?MaintenanceRecord $record, ?CarbonImmutable $expires, CarbonImmutable $at, array $lines): Document
    {
        $isPng = str_ends_with($filename, '.png');
        $content = $isPng ? $this->demoPng() : $this->demoPdf($title, $lines);
        $path = "documents/{$ws->id}/".Str::uuid().($isPng ? '.png' : '.pdf');
        Storage::disk('local')->put($path, $content);

        return Document::create([
            'vehicle_id' => $vehicle->id, 'maintenance_record_id' => $record?->id, 'title' => $title,
            'document_type' => $type, 'disk' => 'local', 'path' => $path, 'original_filename' => $filename,
            'mime_type' => $isPng ? 'image/png' : 'application/pdf', 'size' => strlen($content),
            'expires_at' => $expires?->toDateString(), 'created_at' => $at, 'updated_at' => $at,
        ]);
    }

    /** PDF mínimo válido de una página (Helvetica, WinAnsi) sin dependencias. */
    private function demoPdf(string $title, array $lines): string
    {
        $esc = fn (string $s) => str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], mb_convert_encoding($s, 'Windows-1252', 'UTF-8'));
        $text = 'BT /F1 18 Tf 56 770 Td ('.$esc($title).") Tj ET\n";
        $y = 730;
        foreach ($lines as $line) {
            $text .= "BT /F1 11 Tf 56 {$y} Td (".$esc($line).") Tj ET\n";
            $y -= 18;
        }
        $objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
            '<< /Length '.strlen($text)." >>\nstream\n".$text.'endstream',
        ];
        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $i => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($i + 1)." 0 obj\n{$object}\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= 'xref'."\n0 ".(count($objects) + 1)."\n0000000000 65535 f \n";
        foreach ($offsets as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }

        return $pdf.'trailer'."\n<< /Size ".(count($objects) + 1)." /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF\n";
    }

    /** PNG 160×100 con un degradado (imagen de ejemplo) generado sin GD. */
    private function demoPng(): string
    {
        $w = 160;
        $h = 100;
        $raw = '';
        for ($y = 0; $y < $h; $y++) {
            $raw .= "\0";
            for ($x = 0; $x < $w; $x++) {
                $scratch = abs(($y - 30) - (int) ($x * 0.35)) < 2 && $x > 40 && $x < 130;
                $raw .= $scratch ? "\xE5\xE7\xEB" : chr(150 + (int) ($x / 4)).chr(30 + (int) ($y / 5)).chr(32);
            }
        }
        $chunk = fn (string $type, string $data) => pack('N', strlen($data)).$type.$data.pack('N', crc32($type.$data));

        return "\x89PNG\r\n\x1a\n"
            .$chunk('IHDR', pack('NNCCCCC', $w, $h, 8, 2, 0, 0, 0))
            .$chunk('IDAT', gzcompress($raw, 9))
            .$chunk('IEND', '');
    }

    // ═══════════════════════════════ Taller ═══════════════════════════════

    private function seedWorkshop(): void
    {
        $owner = $this->createUser('Marcos Demo', 'taller@carcare.test', 'workshop', 'Taller Demo', daysAgo: 420);
        $manager = $this->createUser('Elena Demo', 'gerente@carcare.test', 'personal', daysAgo: 410);
        $mechanic = $this->createUser('Andrés Demo', 'mecanico@carcare.test', 'personal', daysAgo: 405);

        /** @var Workspace $ws */
        $ws = $owner->workspaces()->where('type', 'workshop')->firstOrFail();
        $ws->forceFill(['settings' => ['bays_count' => 4, 'currency' => 'EUR', 'tax_rate' => '21.00']])->save();
        $ws->members()->attach($manager->id, ['role' => WorkspaceRole::Manager->value, 'created_at' => $this->today->subDays(410), 'updated_at' => $this->today->subDays(410)]);
        $ws->members()->attach($mechanic->id, ['role' => WorkspaceRole::Mechanic->value, 'created_at' => $this->today->subDays(405), 'updated_at' => $this->today->subDays(405)]);
        Storage::disk('local')->deleteDirectory("documents/{$ws->id}");

        $customers = $this->workshopCustomers($ws, $owner, $manager);
        $vehicles = $this->workshopVehicles($ws, $customers);
        $this->workOrders($ws, $owner, $manager, $mechanic, $vehicles);

        foreach ($vehicles as $entry) {
            $this->mileage->recalculate($entry['vehicle']);
        }

        $this->fleetReminders($vehicles);
    }

    /** @return list<Customer> */
    private function workshopCustomers(Workspace $ws, User $owner, User $manager): array
    {
        $rows = [
            ['Transportes Ejemplo S.L.', 'flota@transportes-ejemplo.test', '600 000 001', 'B00000001', 'Flota de reparto. Facturar a fin de mes.'],
            ['Autoescuela Muestra', 'info@autoescuela-muestra.test', '600 000 002', 'B00000002', 'Coches de prácticas: priorizar, no pueden parar más de un día.'],
            ['Carmen Ficticia Ruiz', 'carmen.ficticia@ejemplo.test', '600 000 003', null, null],
            ['Javier Inventado López', 'javier.inventado@ejemplo.test', '600 000 004', null, 'Prefiere que le llamen por la tarde.'],
            ['Floristería Demo', 'pedidos@floristeria-demo.test', '600 000 005', 'B00000005', null],
            ['Nuria Ejemplo Sanz', null, '600 000 006', null, null],
            ['Pablo Supuesto Gil', 'pablo.supuesto@ejemplo.test', '600 000 007', null, null],
            ['Marta Imaginaria Vidal', 'marta.imaginaria@ejemplo.test', '600 000 008', null, 'Cliente desde la apertura.'],
            ['Taxi Demo 24h', 'taxi24@ejemplo.test', '600 000 009', 'B00000009', 'Taxi: trabajo urgente siempre que sea posible.'],
            ['Sergio Hipotético Mora', null, '600 000 010', null, null],
            ['Lucas Ficticio Pardo', 'lucas.ficticio@ejemplo.test', '600 000 011', null, null],
            ['Inés Muestra Calvo', 'ines.muestra@ejemplo.test', '600 000 012', null, null],
        ];

        $customers = [];
        foreach ($rows as $i => [$name, $email, $phone, $taxId, $notes]) {
            $at = $this->today->subDays(400 - $i * 23)->setTime(11, 0);
            $customer = Customer::create([
                'workspace_id' => $ws->id, 'name' => $name, 'email' => $email, 'phone' => $phone,
                'tax_id' => $taxId, 'notes' => $notes, 'created_at' => $at, 'updated_at' => $at,
            ]);
            $by = $i % 3 === 0 ? $manager : $owner;
            $this->activity($ws, $by, null, 'customer.created', 'customer', $customer->id, "{$by->name} dio de alta al cliente {$name}", $at);
            $customers[] = $customer;
        }

        return $customers;
    }

    /** @return list<array{vehicle: Vehicle, base: int, daily: int, since: CarbonImmutable}> */
    private function workshopVehicles(Workspace $ws, array $customers): array
    {
        // [cliente, marca, modelo, versión, año, combustible, cambio, carrocería, color, matrícula, km al alta, km/día, apodo]
        $rows = [
            [0, 'Ford', 'Transit Custom', '2.0 EcoBlue', 2020, 'diesel', 'manual', 'van', '#F5F5F4', '2207LBC', 148200, 160, 'Reparto 1'],
            [0, 'Renault', 'Kangoo', '1.5 dCi', 2019, 'diesel', 'manual', 'van', '#F5F5F4', '9930KZF', 171500, 130, 'Reparto 2'],
            [0, 'Citroën', 'Berlingo', '1.5 BlueHDi', 2022, 'diesel', 'manual', 'van', '#1E3A8A', '5512MDK', 64300, 120, 'Reparto 3'],
            [0, 'Toyota', 'Hilux', '2.4 D-4D', 2021, 'diesel', 'manual', 'pickup', '#111827', '3348LTV', 88900, 90, null],
            [1, 'Volkswagen', 'Polo', '1.0 TSI', 2022, 'gasoline', 'manual', 'hatchback', '#0EA5E9', '6701MCH', 71200, 110, 'Prácticas 1'],
            [1, 'Renault', 'Clio', '1.0 TCe', 2021, 'gasoline', 'manual', 'hatchback', '#EA580C', '1185LXR', 98600, 115, 'Prácticas 2'],
            [2, 'Toyota', 'Corolla', '1.8 Hybrid', 2020, 'hybrid', 'automatic', 'sedan', '#9CA3AF', '4470LJD', 76100, 45, null],
            [3, 'Skoda', 'Octavia Combi', '2.0 TDI', 2018, 'diesel', 'manual', 'wagon', '#065F46', '8823KJP', 182400, 70, null],
            [4, 'Fiat', 'Doblò', '1.6 Multijet', 2017, 'diesel', 'manual', 'van', '#F59E0B', '0391KBN', 203300, 60, null],
            [5, 'Peugeot', '3008', '1.5 BlueHDi', 2021, 'diesel', 'automatic', 'suv', '#B91C1C', '7764LWS', 58700, 40, null],
            [6, 'BMW', 'Serie 4 Coupé', '420d', 2019, 'diesel', 'automatic', 'coupe', '#111827', '2650KVY', 94200, 35, null],
            [7, 'Mazda', 'MX-5', '2.0 Skyactiv-G', 2018, 'gasoline', 'manual', 'convertible', '#B91C1C', '5106KHG', null, 0, null],
            [8, 'Toyota', 'Prius+', '1.8 Hybrid', 2019, 'hybrid', 'automatic', 'minivan', '#F5F5F4', '6629KSM', 311500, 260, 'Taxi 24h'],
            [9, 'Seat', 'León', '1.5 TSI', 2020, 'gasoline', 'manual', 'hatchback', '#7C3AED', '3902LGZ', 67800, 38, null],
            [10, 'Dacia', 'Duster', '1.5 dCi 4x4', 2019, 'diesel', 'manual', 'suv', '#78350F', '1477KTN', 121900, 55, null],
            [11, 'Hyundai', 'Kona Eléctrico', '64 kWh', 2022, 'electric', 'automatic', 'suv', '#0EA5E9', '8215MBF', 39400, 42, null],
            [2, 'Opel', 'Zafira', '1.6 CDTi', 2016, 'diesel', 'manual', 'minivan', '#9CA3AF', '9058JRW', 214600, 48, null],
            [5, 'Audi', 'A4 Avant', '2.0 TDI', 2017, 'diesel', 'automatic', 'wagon', '#1F2937', '4731JZB', 167300, 52, null],
            [3, 'Ford', 'Ranger', '2.0 EcoBlue', 2023, 'diesel', 'manual', 'pickup', '#9A3412', '2584MNX', 31200, 65, null],
            [6, 'Kia', 'Ceed', '1.6 CRDi', 2018, 'diesel', 'manual', 'sedan', '#047857', '6340KMW', 139800, 47, null],
        ];

        $vehicles = [];
        foreach ($rows as $i => [$c, $make, $model, $version, $year, $fuel, $gearbox, $body, $color, $plate, $baseKm, $daily, $nickname]) {
            $since = $this->today->subDays(380 - $i * 9);
            $vehicle = Vehicle::create([
                'workspace_id' => $ws->id, 'customer_id' => $customers[$c]->id, 'nickname' => $nickname,
                'make' => $make, 'model' => $model, 'version' => $version, 'year' => $year, 'fuel_type' => $fuel,
                'transmission' => $gearbox, 'body_type' => $body, 'color_hex' => $color, 'plate' => $plate,
                'created_at' => $since->setTime(12, 0), 'updated_at' => $since->setTime(12, 0),
            ]);
            if ($baseKm !== null) {
                $this->log($vehicle, $since, $baseKm, MileageSource::VehicleCreated, $vehicle->id);
            }
            $vehicles[] = ['vehicle' => $vehicle, 'base' => $baseKm, 'daily' => $daily, 'since' => $since];
        }

        return $vehicles;
    }

    /** km estimado del vehículo de taller en una fecha (para mileage_in). */
    private function fleetKm(array $entry, CarbonImmutable $date): ?int
    {
        if ($entry['base'] === null) {
            return null;
        }

        return $entry['base'] + max(0, (int) $entry['since']->diffInDays($date)) * $entry['daily'];
    }

    /** Trabajos tipo con sus líneas (precios orientativos ficticios). */
    private function jobs(): array
    {
        $labor = fn (string $hours, string $name = 'Mano de obra') => ['kind' => 'labor', 'name' => $name, 'part_number' => null, 'quantity' => $hours, 'unit_price' => '48.00'];
        $part = fn (string $name, string $qty, string $price, ?string $ref = null) => ['kind' => 'part', 'name' => $name, 'part_number' => $ref, 'quantity' => $qty, 'unit_price' => $price];
        $fluid = fn (string $name, string $qty, string $price) => ['kind' => 'fluid', 'name' => $name, 'part_number' => null, 'quantity' => $qty, 'unit_price' => $price];

        return [
            'oil' => ['Cambio de aceite y filtros', 'Toca revisión de aceite.', 'Aceite y filtros sustituidos. Nivel correcto.', [$fluid('Aceite 5W-30 (litros)', '5.00', '9.80'), $part('Filtro de aceite', '1', '12.50', 'FO-1042'), $part('Filtro de aire', '1', '18.90', 'FA-2210'), $labor('0.80')]],
            'brakes' => ['Discos y pastillas delanteros', 'Ruido metálico al frenar.', 'Pastillas al límite y discos rayados.', [$part('Disco de freno delantero', '2', '48.60', 'DF-118'), $part('Juego de pastillas', '1', '39.90', 'PF-3302'), $labor('1.50')]],
            'diagnosis' => ['Diagnóstico de testigo de motor', 'Testigo de motor encendido desde ayer.', 'Sonda lambda con lectura errática.', [$labor('1.00', 'Diagnosis electrónica'), $part('Sonda lambda', '1', '86.40', 'SL-2290')]],
            'clutch' => ['Sustitución del embrague', 'El embrague patina en cuesta.', 'Disco de embrague desgastado.', [$part('Kit de embrague', '1', '289.00', 'KE-5510'), $fluid('Líquido hidráulico (litros)', '0.50', '12.00'), $labor('5.00')]],
            'timing' => ['Correa de distribución y bomba de agua', 'Mantenimiento por kilometraje.', 'Kit de distribución sustituido según fabricante.', [$part('Kit de distribución', '1', '189.50', 'KD-7781'), $part('Bomba de agua', '1', '64.30', 'BA-0912'), $fluid('Refrigerante (litros)', '3.00', '6.20'), $labor('4.00')]],
            'pre_itv' => ['Revisión pre-ITV', 'Pasa la ITV la semana que viene.', 'Luces y holguras revisadas; una lámpara fundida.', [$labor('1.00', 'Revisión pre-ITV'), $part('Lámpara H7', '2', '7.90')]],
            'tyres' => ['Cuatro neumáticos nuevos', 'Neumáticos gastados.', 'Dibujo por debajo de 2 mm.', [$part('Neumático 205/55 R16', '4', '79.90'), $labor('4.00', 'Montaje y equilibrado')]],
            'ac' => ['Carga de aire acondicionado', 'El aire no enfría.', 'Falta de gas; sin fugas detectadas.', [$fluid('Gas R1234yf (kg)', '0.50', '96.00'), $labor('0.70')]],
            'alternator' => ['Reparación del alternador', 'Se enciende el testigo de batería.', 'Alternador sin carga.', [$part('Alternador reacondicionado', '1', '210.00', 'AL-3307'), $labor('2.00')]],
            'shocks' => ['Amortiguadores traseros', 'Rebota mucho en los baches.', 'Amortiguadores traseros sin efecto.', [$part('Amortiguador trasero', '2', '74.50', 'AM-2041'), $labor('2.00')]],
            'battery' => ['Cambio de batería', 'No arranca por las mañanas.', 'Batería con un 40 % de capacidad.', [$part('Batería 70 Ah', '1', '119.90', 'BT-70640'), $labor('0.30')]],
            'exhaust' => ['Fuga en el escape', 'Hace mucho ruido el tubo de escape.', 'Silenciador intermedio perforado.', [$part('Silenciador intermedio', '1', '96.40', 'SI-118'), $part('Abrazadera', '2', '4.50'), $labor('1.20')]],
            'service' => ['Revisión oficial', 'Revisión de mantenimiento anual.', 'Revisión completa según plan del fabricante.', [$fluid('Aceite 0W-30 (litros)', '5.30', '11.40'), $part('Filtro de aceite', '1', '14.20'), $part('Filtro de habitáculo', '1', '16.40'), $part('Filtro de combustible', '1', '38.70'), $labor('2.00')]],
            'alignment' => ['Alineación de dirección', 'El volante tira hacia la derecha.', 'Convergencia fuera de cotas.', [$labor('1.00', 'Alineación 3D')]],
            'wipers' => ['Escobillas y lámparas', 'Escobillas que dejan marcas.', null, [$part('Juego de escobillas', '1', '24.90'), $labor('0.20')]],
        ];
    }

    private function workOrders(Workspace $ws, User $owner, User $manager, User $mechanic, array $vehicles): void
    {
        $now = CarbonImmutable::now();
        $today = $this->today;
        $at = fn (int $daysAgo, int $h, int $m = 0) => $today->subDays($daysAgo)->setTime($h, $m);

        // [vehículo, trabajo, estado, recibida, prometida, elevador, asignada, prioridad]
        $specs = [
            // Entregadas (repartidas en los últimos 12 meses: alimentan facturación y analítica).
            [0, 'oil', 'delivered', $at(340, 8, 30), $at(339, 18), null, $mechanic, 'normal'],
            [7, 'timing', 'delivered', $at(318, 9, 10), $at(316, 19), null, $mechanic, 'normal'],
            [12, 'brakes', 'delivered', $at(296, 8, 5), $at(296, 19), null, $owner, 'urgent'],
            [3, 'service', 'delivered', $at(271, 10, 0), $at(270, 18), null, $mechanic, 'normal'],
            [8, 'clutch', 'delivered', $at(244, 8, 45), $at(241, 19), null, $mechanic, 'high'],
            [5, 'pre_itv', 'delivered', $at(219, 9, 30), $at(219, 14), null, $owner, 'high'],
            [13, 'ac', 'delivered', $at(193, 11, 0), $at(193, 18), null, $mechanic, 'low'],
            [1, 'alternator', 'delivered', $at(168, 8, 15), $at(167, 18), null, $mechanic, 'high'],
            [16, 'shocks', 'delivered', $at(141, 9, 0), $at(140, 19), null, $owner, 'normal'],
            [12, 'tyres', 'delivered', $at(117, 8, 20), $at(117, 13), null, $mechanic, 'urgent'],
            [9, 'battery', 'delivered', $at(89, 9, 40), $at(89, 12), null, $mechanic, 'normal'],
            [17, 'exhaust', 'delivered', $at(63, 10, 15), $at(62, 18), null, $owner, 'normal'],
            [4, 'brakes', 'delivered', $at(41, 8, 0), $at(41, 19), null, $mechanic, 'high'],
            [19, 'service', 'delivered', $at(22, 9, 20), $at(21, 18), null, $mechanic, 'normal'],
            [14, 'alignment', 'delivered', $at(8, 12, 0), $at(8, 17), null, $owner, 'low'],
            // Canceladas.
            [10, 'diagnosis', 'cancelled', $at(131, 10, 30), $at(130, 18), null, null, 'normal'],
            [18, 'wipers', 'cancelled', $at(27, 16, 0), null, null, null, 'low'],
            // Abiertas: 3 en elevadores (1, 2 y 3), algunas tarde y algunas para hoy.
            [0, 'brakes', 'in_progress', $at(2, 8, 30), $today->setTime(18, 0), 1, $mechanic, 'high'],
            [12, 'clutch', 'in_progress', $at(3, 9, 0), $at(1, 19), 2, $mechanic, 'urgent'],
            [6, 'ac', 'in_progress', $at(1, 16, 30), $today->addDay()->setTime(13, 0), null, $owner, 'normal'],
            [1, 'diagnosis', 'diagnosing', $at(1, 8, 10), $today->setTime(19, 0), 3, $mechanic, 'high'],
            [15, 'diagnosis', 'diagnosing', $at(2, 11, 45), $today->addDays(2)->setTime(18, 0), null, null, 'normal'],
            [2, 'timing', 'waiting_parts', $at(6, 9, 0), $at(2, 18), null, $mechanic, 'high'],
            [7, 'alternator', 'waiting_parts', $at(4, 10, 30), $today->addDays(3)->setTime(18, 0), null, $owner, 'normal'],
            [16, 'exhaust', 'waiting_parts', $at(9, 9, 15), $at(1, 13), null, $mechanic, 'normal'],
            [5, 'pre_itv', 'ready', $at(1, 8, 0), $today->setTime(13, 30), null, $mechanic, 'high'],
            [9, 'tyres', 'ready', $at(2, 9, 30), $at(1, 18), null, $owner, 'normal'],
            [13, 'battery', 'ready', $at(1, 17, 40), null, null, $mechanic, 'low'],
            [4, 'oil', 'received', $today->setTime(8, 40), $today->addDays(1)->setTime(14, 0), null, null, 'normal'],
            [10, 'shocks', 'received', $at(1, 18, 10), $today->addDays(2)->setTime(19, 0), null, null, 'normal'],
            [11, 'service', 'received', $today->setTime(10, 15), null, null, null, 'low'],
        ];

        usort($specs, fn ($a, $b) => $a[3] <=> $b[3]);

        $jobs = $this->jobs();
        $sequences = [];

        foreach ($specs as [$vIndex, $jobKey, $status, $receivedAt, $promisedAt, $bay, $assignee, $priority]) {
            $entry = $vehicles[$vIndex];
            /** @var Vehicle $vehicle */
            $vehicle = $entry['vehicle'];
            [$title, $complaint, $diagnosis, $items] = $jobs[$jobKey];
            $status = WorkOrderStatus::from($status);
            $receivedAt = $receivedAt->min($now);

            $year = $receivedAt->year;
            $sequences[$year] = ($sequences[$year] ?? 0) + 1;
            $number = sprintf('OT-%d-%04d', $year, $sequences[$year]);

            $rows = LineItems::rows($items);
            $subtotal = LineItems::sumCents($rows) ?? 0;
            $tax = Money::percentOf($subtotal, '21.00');

            $completedAt = null;
            $deliveredAt = null;
            if ($status === WorkOrderStatus::Delivered) {
                $deliveredAt = ($promisedAt ?? $receivedAt->addDay())->subMinutes(mt_rand(0, 90));
                $completedAt = $deliveredAt->subHours(mt_rand(1, 5));
            } elseif ($status === WorkOrderStatus::Ready) {
                $completedAt = $receivedAt->addHours(mt_rand(3, 8))->min($now->subMinutes(20));
            }

            $mileageIn = $this->fleetKm($entry, $receivedAt->startOfDay());
            $updatedAt = $deliveredAt ?? $completedAt ?? $receivedAt->addHours(2)->min($now);

            $order = WorkOrder::create([
                'workspace_id' => $ws->id, 'vehicle_id' => $vehicle->id, 'customer_id' => $vehicle->customer_id,
                'number' => $number, 'year' => $year, 'sequence' => $sequences[$year],
                'title' => $title, 'complaint' => $complaint,
                'diagnosis' => in_array($status, [WorkOrderStatus::Received], true) ? null : $diagnosis,
                'status' => $status, 'priority' => $priority, 'bay' => $bay, 'assigned_to' => $assignee?->id,
                'mileage_in' => $mileageIn, 'received_at' => $receivedAt, 'promised_at' => $promisedAt,
                'completed_at' => $completedAt, 'delivered_at' => $deliveredAt,
                'subtotal' => Money::format($subtotal), 'tax_rate' => '21.00', 'tax_amount' => Money::format($tax),
                'total' => Money::format($subtotal + $tax),
                'created_at' => $receivedAt, 'updated_at' => $updatedAt,
            ]);
            $order->items()->createMany($rows);

            if ($mileageIn !== null) {
                $this->log($vehicle, $receivedAt->startOfDay(), $mileageIn, MileageSource::WorkOrder, $order->id);
            }

            if ($status === WorkOrderStatus::Delivered) {
                $record = $this->maintenance->createFromWorkOrder($order);
                $record->forceFill(['created_at' => $deliveredAt, 'updated_at' => $deliveredAt])->save();
                $order->forceFill(['maintenance_record_id' => $record->id])->saveQuietly();
            }

            $this->workOrderActivity($ws, $owner, $manager, $mechanic, $order, $vehicle, $status);
        }
    }

    private function workOrderActivity(Workspace $ws, User $owner, User $manager, User $mechanic, WorkOrder $order, Vehicle $vehicle, WorkOrderStatus $status): void
    {
        $received = $order->received_at->toImmutable();
        if ($received < $this->today->subDays(45)) {
            return;
        }

        $label = $vehicle->displayName().($vehicle->plate ? " ({$vehicle->plate})" : '');
        $opener = $order->id % 2 === 0 ? $manager : $owner;
        $this->activity($ws, $opener, $vehicle, 'work_order.created', 'work_order', $order->id,
            "{$opener->name} abrió la orden {$order->number} para {$label}", $received, ['status' => 'received']);

        $path = match ($status) {
            WorkOrderStatus::Diagnosing => ['diagnosing'],
            WorkOrderStatus::WaitingParts => ['diagnosing', 'waiting_parts'],
            WorkOrderStatus::InProgress => ['diagnosing', 'in_progress'],
            WorkOrderStatus::Ready => ['diagnosing', 'in_progress', 'ready'],
            WorkOrderStatus::Delivered => ['diagnosing', 'in_progress', 'ready', 'delivered'],
            WorkOrderStatus::Cancelled => ['cancelled'],
            default => [],
        };

        $end = ($order->delivered_at ?? $order->completed_at ?? CarbonImmutable::now())->toImmutable();
        $step = max(10, (int) ($received->diffInMinutes($end) / (count($path) + 1)));
        $from = 'received';
        foreach ($path as $i => $to) {
            $at = $received->addMinutes($step * ($i + 1))->min(CarbonImmutable::now()->subMinutes(5));
            $actor = in_array($to, ['delivered', 'cancelled'], true) ? $owner : $mechanic;
            $toLabel = WorkOrderStatus::from($to)->label();
            $this->activity($ws, $actor, $vehicle, 'work_order.status_changed', 'work_order', $order->id,
                "{$actor->name} movió {$order->number} a «{$toLabel}»", $at, ['from' => $from, 'to' => $to]);
            $from = $to;
        }
    }

    /** Alertas de flota: ITV vencida, ITV y aceite próximos, y una revisión sin datos de km. */
    private function fleetReminders(array $vehicles): void
    {
        $today = $this->today;
        // Último km conocido por el taller (lecturas de alta y de entrada de órdenes).
        $km = fn (int $i) => (int) $vehicles[$i]['vehicle']->current_mileage;

        $specs = [
            [0, ['title' => 'ITV de la furgoneta', 'kind' => 'itv', 'zone' => 'general', 'due_date' => $today->subDays(9)->toDateString(), 'recurrence_months' => 12, 'starts_on' => $today->subDays(9)->subYear()->toDateString()]],
            [1, ['title' => 'ITV', 'kind' => 'itv', 'zone' => 'general', 'due_date' => $today->addDays(12)->toDateString(), 'recurrence_months' => 12, 'starts_on' => $today->addDays(12)->subYear()->toDateString()]],
            [3, ['title' => 'Cambio de aceite', 'kind' => 'oil', 'zone' => 'engine', 'due_mileage' => $km(3) + 600, 'recurrence_km' => 15000, 'starts_on' => $today->subDays(160)->toDateString(), 'start_mileage' => $km(3) - 14400]],
            [12, ['title' => 'Revisión de taxi', 'kind' => 'service', 'zone' => 'general', 'due_date' => $today->addDays(47)->toDateString(), 'due_mileage' => $km(12) + 9000, 'recurrence_months' => 6, 'starts_on' => $today->subDays(135)->toDateString(), 'start_mileage' => $km(12) - 6000]],
            [11, ['title' => 'Revisión de la capota', 'kind' => 'custom', 'zone' => 'body', 'notes' => 'El cliente no recuerda el kilometraje.', 'due_mileage' => 60000, 'starts_on' => $today->subDays(30)->toDateString()]],
            [5, ['title' => 'Pastillas de freno', 'kind' => 'brakes', 'zone' => 'brakes', 'due_mileage' => $km(5) + 4200, 'starts_on' => $today->subDays(219)->toDateString(), 'start_mileage' => $km(5) - 20800]],
        ];

        foreach ($specs as [$i, $data]) {
            $this->reminder($vehicles[$i]['vehicle'], $data);
        }
    }
}
