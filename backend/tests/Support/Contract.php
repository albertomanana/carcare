<?php

namespace Tests\Support;

use App\Enums\BodyType;
use App\Enums\DocumentType;
use App\Enums\ExpenseCategory;
use App\Enums\FuelType;
use App\Enums\FuelUnit;
use App\Enums\ItemKind;
use App\Enums\MileageSource;
use App\Enums\Priority;
use App\Enums\RecordType;
use App\Enums\ReminderKind;
use App\Enums\ReminderState;
use App\Enums\ReminderStatus;
use App\Enums\ServiceKind;
use App\Enums\Transmission;
use App\Enums\WorkOrderStatus;
use App\Enums\WorkspaceRole;
use App\Enums\WorkspaceType;
use App\Enums\Zone;
use PHPUnit\Framework\Assert;

/**
 * Formas JSON del contrato (frontend/src/api/types.ts) escritas como especificaciones comprobables.
 *
 * Especificación:
 *  - string primitivo: 'int', 'number', 'string', 'bool', 'money' ('1234.50'), 'decimal' (2 decimales),
 *    'date' ('YYYY-MM-DD'), 'datetime' (ISO 8601 con zona), 'month' ('YYYY-MM'), 'scalar', 'enum:a,b,c'.
 *    Con prefijo '?' admite null.
 *  - array asociativo: objeto con EXACTAMENTE esas claves (ni una más ni una menos).
 *  - self::listOf($spec): lista JSON cuyos elementos cumplen $spec.
 *  - self::nullable($spec): null o un objeto que cumple $spec.
 *  - self::recordOf($spec): objeto con claves libres y valores que cumplen $spec.
 *
 * ContractShapeTest comprueba además que las claves de primer nivel de cada especificación coinciden
 * con las de la interfaz homónima de types.ts, así que si el contrato cambia, el test lo detecta.
 */
final class Contract
{
    private const LIST = '__list';

    private const NULLABLE = '__nullable';

    private const RECORD = '__record';

    // ───────────────────────── Motor de comprobación ─────────────────────────

    public static function listOf(string|array $spec): array
    {
        return [self::LIST => $spec];
    }

    public static function nullable(array $spec): array
    {
        return [self::NULLABLE => $spec];
    }

    public static function recordOf(string|array $spec): array
    {
        return [self::RECORD => $spec];
    }

    /** @param  class-string<\BackedEnum>  $enum */
    public static function enum(string $enum, bool $nullable = false): string
    {
        return ($nullable ? '?' : '').'enum:'.implode(',', array_column($enum::cases(), 'value'));
    }

    public static function assert(mixed $value, string|array $spec, string $path = 'data'): void
    {
        if (is_string($spec)) {
            self::assertPrimitive($value, $spec, $path);

            return;
        }

        if (array_key_exists(self::NULLABLE, $spec)) {
            if ($value !== null) {
                self::assert($value, $spec[self::NULLABLE], $path);
            }

            return;
        }

        if (array_key_exists(self::LIST, $spec)) {
            Assert::assertIsArray($value, "{$path}: se esperaba una lista");
            Assert::assertTrue(array_is_list($value), "{$path}: se esperaba una lista, no un objeto");
            foreach ($value as $i => $item) {
                self::assert($item, $spec[self::LIST], "{$path}.{$i}");
            }

            return;
        }

        if (array_key_exists(self::RECORD, $spec)) {
            Assert::assertIsArray($value, "{$path}: se esperaba un objeto");
            Assert::assertFalse($value !== [] && array_is_list($value), "{$path}: se esperaba un objeto, no una lista");
            foreach ($value as $key => $item) {
                Assert::assertIsString($key, "{$path}: las claves deben ser texto");
                self::assert($item, $spec[self::RECORD], "{$path}.{$key}");
            }

            return;
        }

        Assert::assertIsArray($value, "{$path}: se esperaba un objeto");
        $expected = array_keys($spec);
        $actual = array_keys($value);
        $missing = array_values(array_diff($expected, $actual));
        $extra = array_values(array_diff($actual, $expected));
        Assert::assertSame([], $missing, "{$path}: faltan campos del contrato: ".implode(', ', $missing));
        Assert::assertSame([], $extra, "{$path}: sobran campos que no están en el contrato: ".implode(', ', $extra));

        foreach ($spec as $key => $child) {
            self::assert($value[$key], $child, "{$path}.{$key}");
        }
    }

    private static function assertPrimitive(mixed $value, string $spec, string $path): void
    {
        if (str_starts_with($spec, '?')) {
            if ($value === null) {
                return;
            }
            $spec = substr($spec, 1);
        }

        $shown = var_export($value, true);

        if (str_starts_with($spec, 'enum:')) {
            $allowed = explode(',', substr($spec, 5));
            Assert::assertContains($value, $allowed, "{$path}: {$shown} no es uno de [".implode(', ', $allowed).']');

            return;
        }

        $ok = match ($spec) {
            'int' => is_int($value),
            'number' => is_int($value) || is_float($value),
            'string' => is_string($value),
            'bool' => is_bool($value),
            'scalar' => $value === null || is_scalar($value),
            'money', 'decimal' => is_string($value) && preg_match('/^-?\d+\.\d{2}$/', $value) === 1,
            'date' => is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1,
            'datetime' => is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}:\d{2}|Z)$/', $value) === 1,
            'month' => is_string($value) && preg_match('/^\d{4}-\d{2}$/', $value) === 1,
            default => Assert::fail("Especificación desconocida '{$spec}' en {$path}"),
        };

        Assert::assertTrue($ok, "{$path}: {$shown} no es de tipo {$spec}");
    }

    // ───────────────────────── Usuario y espacios ─────────────────────────

    public static function user(): array
    {
        return ['id' => 'int', 'name' => 'string', 'email' => 'string', 'locale' => 'string', 'created_at' => 'datetime'];
    }

    public static function workspaceSettings(): array
    {
        return ['bays_count' => 'int', 'currency' => 'enum:EUR', 'tax_rate' => 'decimal'];
    }

    public static function workspace(): array
    {
        return [
            'id' => 'int',
            'name' => 'string',
            'type' => self::enum(WorkspaceType::class),
            'role' => self::enum(WorkspaceRole::class),
            'settings' => self::workspaceSettings(),
            'vehicles_count' => 'int',
            'members_count' => 'int',
            'created_at' => 'datetime',
        ];
    }

    public static function me(): array
    {
        return ['user' => self::user(), 'workspaces' => self::listOf(self::workspace())];
    }

    public static function member(): array
    {
        return [
            'user' => ['id' => 'int', 'name' => 'string', 'email' => 'string'],
            'role' => self::enum(WorkspaceRole::class),
            'joined_at' => 'datetime',
        ];
    }

    // ───────────────────────── Vehículos ─────────────────────────

    public static function vehicleRef(): array
    {
        return [
            'id' => 'int',
            'display_name' => 'string',
            'make' => 'string',
            'model' => 'string',
            'plate' => '?string',
            'body_type' => self::enum(BodyType::class, true),
            'color_hex' => '?string',
        ];
    }

    public static function customerRef(): array
    {
        return ['id' => 'int', 'name' => 'string', 'phone' => '?string'];
    }

    public static function workOrderRef(): array
    {
        return ['id' => 'int', 'number' => 'string', 'status' => self::enum(WorkOrderStatus::class), 'bay' => '?int'];
    }

    public static function vehicleStats(): array
    {
        return [
            'records_count' => 'int',
            'pending_reminders' => 'int',
            'overdue_reminders' => 'int',
            'soon_reminders' => 'int',
            'open_work_order' => self::nullable(self::workOrderRef()),
        ];
    }

    public static function vehicle(): array
    {
        return [
            'id' => 'int',
            'workspace_id' => 'int',
            'customer' => self::nullable(self::customerRef()),
            'nickname' => '?string',
            'make' => 'string',
            'model' => 'string',
            'version' => '?string',
            'year' => '?int',
            'fuel_type' => self::enum(FuelType::class, true),
            'transmission' => self::enum(Transmission::class, true),
            'engine' => '?string',
            'body_type' => self::enum(BodyType::class, true),
            'color_hex' => '?string',
            'plate' => '?string',
            'vin' => '?string',
            'purchase_date' => '?date',
            'purchase_mileage' => '?int',
            'current_mileage' => '?int',
            'mileage_updated_at' => '?date',
            'display_name' => 'string',
            'archived_at' => '?datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
            'stats' => self::vehicleStats(),
        ];
    }

    public static function mileageLog(): array
    {
        return [
            'id' => 'int',
            'vehicle_id' => 'int',
            'recorded_at' => 'date',
            'mileage' => 'int',
            'source' => self::enum(MileageSource::class),
            'source_id' => '?int',
            'note' => '?string',
            'created_at' => 'datetime',
        ];
    }

    // ───────────────────────── Intervenciones y gastos ─────────────────────────

    public static function lineItem(): array
    {
        return [
            'id' => 'int',
            'kind' => self::enum(ItemKind::class),
            'name' => 'string',
            'part_number' => '?string',
            'quantity' => 'decimal',
            'unit_price' => '?money',
            'total' => '?money',
        ];
    }

    public static function maintenanceRecord(): array
    {
        return [
            'id' => 'int',
            'vehicle_id' => 'int',
            'type' => self::enum(RecordType::class),
            'zone' => self::enum(Zone::class),
            'service_kind' => self::enum(ServiceKind::class, true),
            'title' => 'string',
            'description' => '?string',
            'service_date' => 'date',
            'mileage' => '?int',
            'workshop_name' => '?string',
            'parts_cost' => '?money',
            'labor_cost' => '?money',
            'total_cost' => '?money',
            'currency' => 'enum:EUR',
            'items' => self::listOf(self::lineItem()),
            'expense_id' => '?int',
            'work_order_id' => '?int',
            'documents_count' => 'int',
            'archived_at' => '?datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public static function maintenanceRecordRef(): array
    {
        return [
            'id' => 'int',
            'type' => self::enum(RecordType::class),
            'zone' => self::enum(Zone::class),
            'service_kind' => self::enum(ServiceKind::class, true),
            'title' => 'string',
            'service_date' => 'date',
            'mileage' => '?int',
            'total_cost' => '?money',
        ];
    }

    public static function expense(): array
    {
        return [
            'id' => 'int',
            'vehicle_id' => 'int',
            'category' => self::enum(ExpenseCategory::class),
            'description' => '?string',
            'amount' => 'money',
            'currency' => 'enum:EUR',
            'expense_date' => 'date',
            'mileage' => '?int',
            'fuel_quantity' => '?decimal',
            'fuel_unit' => self::enum(FuelUnit::class, true),
            'full_tank' => '?bool',
            'maintenance_record_id' => '?int',
            'is_linked' => 'bool',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    // ───────────────────────── Recordatorios y zonas ─────────────────────────

    /** `vehicle` solo aparece en la agenda del espacio y en los dashboards. */
    public static function reminder(bool $withVehicle = false): array
    {
        $head = ['id' => 'int', 'vehicle_id' => 'int'];
        if ($withVehicle) {
            $head['vehicle'] = self::vehicleRef();
        }

        return $head + [
            'title' => 'string',
            'kind' => self::enum(ReminderKind::class),
            'zone' => self::enum(Zone::class),
            'notes' => '?string',
            'due_date' => '?date',
            'due_mileage' => '?int',
            'recurrence_months' => '?int',
            'recurrence_km' => '?int',
            'starts_on' => 'date',
            'start_mileage' => '?int',
            'status' => self::enum(ReminderStatus::class),
            'completed_at' => '?date',
            'completed_mileage' => '?int',
            'state' => self::enum(ReminderState::class, true),
            'days_left' => '?int',
            'km_left' => '?int',
            'progress' => '?number',
            'created_at' => 'datetime',
        ];
    }

    public static function completeReminderResult(): array
    {
        return ['completed' => self::reminder(), 'next' => self::nullable(self::reminder())];
    }

    public static function zoneStatus(): array
    {
        return [
            'zone' => self::enum(Zone::class),
            'label' => 'string',
            'state' => self::enum(ReminderState::class),
            'basis' => 'enum:reminders,records,none',
            'last_record' => self::nullable(self::maintenanceRecordRef()),
            'records_count' => 'int',
            'next_reminder' => self::nullable(self::reminder()),
        ];
    }

    // ───────────────────────── Documentos y diario ─────────────────────────

    public static function vehicleDocument(): array
    {
        return [
            'id' => 'int',
            'vehicle_id' => 'int',
            'maintenance_record_id' => '?int',
            'title' => 'string',
            'document_type' => self::enum(DocumentType::class),
            'original_filename' => 'string',
            'mime_type' => 'string',
            'size' => 'int',
            'expires_at' => '?date',
            'download_url' => 'string',
            'created_at' => 'datetime',
        ];
    }

    public static function journalEntry(): array
    {
        return [
            'type' => 'enum:mileage,expense,record,reminder_done,document',
            'id' => 'int',
            'date' => 'date',
            'title' => 'string',
            'amount' => '?money',
            'mileage' => '?int',
            'meta' => self::recordOf('scalar'),
        ];
    }

    public static function journalDay(): array
    {
        return ['date' => 'date', 'km_driven' => '?int', 'spent' => 'money', 'entries' => self::listOf(self::journalEntry())];
    }

    // ───────────────────────── Resumen, informe y analítica ─────────────────────────

    public static function byCategory(): array
    {
        return ['category' => self::enum(ExpenseCategory::class), 'total' => 'money', 'count' => 'int'];
    }

    public static function byMonth(): array
    {
        return ['month' => 'month', 'total' => 'money'];
    }

    public static function vehicleSummary(): array
    {
        return [
            'period' => ['from' => 'date', 'to' => 'date'],
            'totals' => [
                'period' => 'money',
                'month' => 'money',
                'year' => 'money',
                'previous_period' => '?money',
                'change_pct' => '?number',
            ],
            'by_category' => self::listOf(self::byCategory()),
            'by_month' => self::listOf(self::byMonth()),
            'cost_per_km' => ['available' => 'bool', 'reason' => '?string', 'value' => '?money', 'km' => '?int'],
            'consumption' => [
                'available' => 'bool',
                'reason' => '?string',
                'value' => '?decimal',
                'unit' => '?enum:l/100km,kwh/100km,kg/100km',
                'fills' => 'int',
            ],
            'mileage' => [
                'current' => '?int',
                'updated_at' => '?date',
                'km_this_month' => '?int',
                'km_this_year' => '?int',
                'avg_daily_km' => '?number',
                'series' => self::listOf(['date' => 'date', 'mileage' => 'int']),
            ],
            'records' => [
                'count' => 'int',
                'last' => self::nullable(self::maintenanceRecordRef()),
                'recent' => self::listOf(self::maintenanceRecordRef()),
            ],
            'since_last' => self::listOf([
                'kind' => 'enum:oil,service,itv',
                'label' => 'string',
                'record' => self::nullable(self::maintenanceRecordRef()),
                'days' => '?int',
                'km' => '?int',
            ]),
            'reminders' => ['overdue' => 'int', 'soon' => 'int', 'upcoming' => self::listOf(self::reminder())],
        ];
    }

    public static function vehicleReport(): array
    {
        return [
            'generated_at' => 'datetime',
            'vehicle' => self::vehicle(),
            'records' => self::listOf(self::maintenanceRecord()),
            'expenses' => [
                'total' => 'money',
                'by_category' => self::listOf(self::byCategory()),
                'by_year' => self::listOf(['year' => 'int', 'total' => 'money']),
            ],
            'mileage_logs' => self::listOf(self::mileageLog()),
            'pending_reminders' => self::listOf(self::reminder()),
            'documents' => self::listOf([
                'id' => 'int',
                'title' => 'string',
                'document_type' => self::enum(DocumentType::class),
                'created_at' => 'datetime',
                'expires_at' => '?date',
            ]),
        ];
    }

    // ───────────────────────── Taller ─────────────────────────

    public static function customer(): array
    {
        return [
            'id' => 'int',
            'workspace_id' => 'int',
            'name' => 'string',
            'email' => '?string',
            'phone' => '?string',
            'tax_id' => '?string',
            'notes' => '?string',
            'vehicles_count' => 'int',
            'open_orders_count' => 'int',
            'anonymized_at' => '?datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public static function workOrder(): array
    {
        return [
            'id' => 'int',
            'workspace_id' => 'int',
            'number' => 'string',
            'vehicle' => self::vehicleRef(),
            'customer' => self::nullable(self::customerRef()),
            'title' => 'string',
            'complaint' => '?string',
            'diagnosis' => '?string',
            'status' => self::enum(WorkOrderStatus::class),
            'priority' => self::enum(Priority::class),
            'bay' => '?int',
            'assigned_to' => self::nullable(['id' => 'int', 'name' => 'string']),
            'mileage_in' => '?int',
            'received_at' => 'datetime',
            'promised_at' => '?datetime',
            'completed_at' => '?datetime',
            'delivered_at' => '?datetime',
            'items' => self::listOf(self::lineItem()),
            'subtotal' => 'money',
            'tax_rate' => 'decimal',
            'tax_amount' => 'money',
            'total' => 'money',
            'is_late' => 'bool',
            'maintenance_record_id' => '?int',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public static function bay(): array
    {
        return ['number' => 'int', 'work_order' => self::nullable(self::workOrder())];
    }

    public static function activity(): array
    {
        return [
            'id' => 'int',
            'action' => 'string',
            'entity_type' => 'string',
            'entity_id' => 'int',
            'summary' => 'string',
            'user' => self::nullable(['id' => 'int', 'name' => 'string']),
            'vehicle_id' => '?int',
            'created_at' => 'datetime',
        ];
    }

    // ───────────────────────── Dashboards y analítica de espacio ─────────────────────────

    public static function personalDashboard(): array
    {
        return [
            'type' => 'enum:personal',
            'vehicles' => self::listOf(self::vehicle()),
            'spend' => ['month' => 'money', 'year' => 'money', 'by_month' => self::listOf(self::byMonth())],
            'reminders' => ['overdue' => 'int', 'soon' => 'int', 'upcoming' => self::listOf(self::reminder(true))],
            'recent_activity' => self::listOf(self::activity()),
        ];
    }

    public static function workshopDashboard(): array
    {
        return [
            'type' => 'enum:workshop',
            'counts' => [
                'vehicles' => 'int',
                'customers' => 'int',
                'open_orders' => 'int',
                'late_orders' => 'int',
                'overdue_reminders' => 'int',
            ],
            'orders_by_status' => array_fill_keys(WorkOrderStatus::values(), 'int'),
            'bays' => self::listOf(self::bay()),
            'due_today' => self::listOf(self::workOrder()),
            'late' => self::listOf(self::workOrder()),
            'revenue' => self::nullable(['month' => 'money', 'year' => 'money', 'by_month' => self::listOf(self::byMonth())]),
            'fleet_alerts' => self::listOf(self::reminder(true)),
            'recent_activity' => self::listOf(self::activity()),
        ];
    }

    public static function workspaceAnalytics(): array
    {
        return [
            'period' => ['from' => 'date', 'to' => 'date'],
            'total' => 'money',
            'by_month' => self::listOf(self::byMonth()),
            'by_vehicle' => self::listOf(['vehicle' => self::vehicleRef(), 'total' => 'money']),
            'by_category' => self::listOf(self::byCategory()),
            'workshop' => self::nullable([
                'orders_delivered' => 'int',
                'avg_ticket' => '?money',
                'avg_days_in_shop' => '?number',
                'by_customer' => self::listOf(['customer' => self::customerRef(), 'total' => 'money', 'orders' => 'int']),
            ]),
        ];
    }

    public static function pageMeta(): array
    {
        return ['current_page' => 'int', 'last_page' => 'int', 'per_page' => 'int', 'total' => 'int'];
    }

    /** { data: T[], meta: PageMeta } */
    public static function paginated(array $item): array
    {
        return ['data' => self::listOf($item), 'meta' => self::pageMeta()];
    }

    /**
     * Especificación de cada interfaz de types.ts, para cruzar sus claves de primer nivel.
     *
     * @return array<string, array>
     */
    public static function interfaces(): array
    {
        return [
            'User' => self::user(),
            'WorkspaceSettings' => self::workspaceSettings(),
            'Workspace' => self::workspace(),
            'Me' => self::me(),
            'Member' => self::member(),
            'VehicleRef' => self::vehicleRef(),
            'CustomerRef' => self::customerRef(),
            'WorkOrderRef' => self::workOrderRef(),
            'VehicleStats' => self::vehicleStats(),
            'Vehicle' => self::vehicle(),
            'MileageLog' => self::mileageLog(),
            'LineItem' => self::lineItem(),
            'MaintenanceRecord' => self::maintenanceRecord(),
            'Expense' => self::expense(),
            'Reminder' => self::reminder(true),
            'CompleteReminderResult' => self::completeReminderResult(),
            'ZoneStatus' => self::zoneStatus(),
            'VehicleDocument' => self::vehicleDocument(),
            'JournalEntry' => self::journalEntry(),
            'JournalDay' => self::journalDay(),
            'VehicleSummary' => self::vehicleSummary(),
            'VehicleReport' => self::vehicleReport(),
            'Customer' => self::customer(),
            'WorkOrder' => self::workOrder(),
            'Bay' => self::bay(),
            'Activity' => self::activity(),
            'PersonalDashboard' => self::personalDashboard(),
            'WorkshopDashboard' => self::workshopDashboard(),
            'WorkspaceAnalytics' => self::workspaceAnalytics(),
            'PageMeta' => self::pageMeta(),
        ];
    }

    /**
     * Uniones de literales de types.ts ↔ enums PHP.
     *
     * @return array<string, class-string<\BackedEnum>>
     */
    public static function enums(): array
    {
        return [
            'WorkspaceType' => WorkspaceType::class,
            'WorkspaceRole' => WorkspaceRole::class,
            'FuelType' => FuelType::class,
            'Transmission' => Transmission::class,
            'BodyType' => BodyType::class,
            'MileageSource' => MileageSource::class,
            'RecordType' => RecordType::class,
            'Zone' => Zone::class,
            'ServiceKind' => ServiceKind::class,
            'ItemKind' => ItemKind::class,
            'ExpenseCategory' => ExpenseCategory::class,
            'FuelUnit' => FuelUnit::class,
            'ReminderKind' => ReminderKind::class,
            'ReminderStatus' => ReminderStatus::class,
            'ReminderState' => ReminderState::class,
            'DocumentType' => DocumentType::class,
            'WorkOrderStatus' => WorkOrderStatus::class,
            'Priority' => Priority::class,
        ];
    }
}
