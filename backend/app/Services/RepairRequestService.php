<?php

namespace App\Services;

use App\Enums\NotificationKind;
use App\Enums\Priority;
use App\Enums\RepairQuoteStatus;
use App\Enums\RepairRequestStatus;
use App\Exceptions\ConflictException;
use App\Exceptions\ForbiddenException;
use App\Models\Customer;
use App\Models\MaintenanceRecord;
use App\Models\RepairQuote;
use App\Models\RepairRequest;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\Workspace;
use App\Support\LineItems;
use App\Support\Money;
use Closure;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Solicitudes de reparación de un particular a un taller (contrato §3.13, ADR‑0007).
 *
 *  - Crear: copia fija de 7 datos del coche, límites anti‑spam (429 y 409) y aviso al taller.
 *  - Transiciones (§3.13.4): cada una relee la solicitud con `lockForUpdate` dentro de una transacción,
 *    así que dos clics a la vez dan una transición y un 409.
 *  - Presupuesto (§3.13.5): versiones inmutables; la vigente es la única `sent`.
 *  - Conversión (§3.13.6): al aceptar el cliente la versión vigente, en UNA transacción, cliente del taller
 *    (reutilizado por una solicitud anterior convertida, nunca por email), vehículo del taller (por
 *    `source_vehicle_id` o matrícula) y orden con las líneas y el IVA del presupuesto.
 *  - Actividad (§3.13.9) y avisos (§3.13.8) sin datos personales del particular.
 */
class RepairRequestService
{
    /** Solicitudes que un usuario puede crear en 24 horas (la 6.ª da 429). */
    public const DAILY_LIMIT = 5;

    public const DEFAULT_VALID_DAYS = 15;

    /** Intervenciones que se comparten como máximo en el historial (§3.13.7). */
    public const HISTORY_LIMIT = 50;

    public const MSG_DAILY_LIMIT = 'Has enviado 5 solicitudes en las últimas 24 horas. Vuelve a intentarlo mañana.';

    public const MSG_OPEN_PAIR = 'Ya tienes una solicitud abierta para este vehículo en este taller.';

    public const MSG_CLOSED = 'Esta solicitud ya está cerrada.';

    public const MSG_ALREADY_ANSWERED = 'Esta solicitud ya tiene respuesta.';

    public const MSG_NOT_ACCEPTED = 'Acepta la solicitud antes de enviar un presupuesto (o acéptala directamente con presupuesto).';

    public const MSG_NO_QUOTE = 'Esta solicitud no tiene ningún presupuesto pendiente de respuesta.';

    public const MSG_STALE_QUOTE = 'El taller ha enviado un presupuesto nuevo. Revísalo antes de responder.';

    public const MSG_NO_HISTORY = 'El cliente no comparte su historial con el taller.';

    public function __construct(
        private readonly WorkOrderService $orders,
        private readonly ActivityLogger $activity,
        private readonly RepairRequestNotifier $notifier,
    ) {}

    // ───────────────────────── Listado ─────────────────────────

    /**
     * En un espacio personal, las enviadas; en un taller, las recibidas. `created_at` descendente.
     *
     * @param  list<string>|null  $statuses  Estados (con `open` = pending, accepted y quoted).
     */
    public function list(Workspace $workspace, ?array $statuses, ?int $workOrderId, int $perPage): LengthAwarePaginator
    {
        if ($statuses !== null && in_array('open', $statuses, true)) {
            $statuses = array_values(array_unique([...array_diff($statuses, ['open']), ...RepairRequestStatus::openValues()]));
        }

        return RepairRequest::query()
            ->where($workspace->isPersonal() ? 'requester_workspace_id' : 'workshop_workspace_id', $workspace->id)
            ->when($statuses !== null, fn (Builder $q) => $q->whereIn('status', $statuses))
            ->when($workspace->isWorkshop() && $workOrderId !== null, fn (Builder $q) => $q->where('work_order_id', $workOrderId))
            ->with(RepairRequest::RESOURCE_RELATIONS)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage);
    }

    // ───────────────────────── Crear ─────────────────────────

    /**
     * POST /workspaces/{ws}/repair-requests. El Form Request ya validó el vehículo (de este garaje y sin
     * archivar), el taller (en el directorio y sin ser miembro) y los km (≥ el último anotado).
     * Los km NO crean una lectura en el garaje: son un dato declarado para el taller.
     */
    public function create(Workspace $personal, User $user, Vehicle $vehicle, Workspace $workshop, array $data): RepairRequest
    {
        return DB::transaction(function () use ($personal, $user, $vehicle, $workshop, $data) {
            // Serializa las solicitudes de este garaje: dos clics no se saltan los límites.
            Workspace::query()->whereKey($personal->id)->lockForUpdate()->first();

            $recent = RepairRequest::query()
                ->where('requester_user_id', $user->id)
                ->where('created_at', '>=', now()->subDay())
                ->count();
            if ($recent >= self::DAILY_LIMIT) {
                throw new HttpException(429, self::MSG_DAILY_LIMIT);
            }

            $openPair = RepairRequest::query()->open()
                ->where('vehicle_id', $vehicle->id)
                ->where('workshop_workspace_id', $workshop->id)
                ->exists();
            if ($openPair) {
                throw new ConflictException(self::MSG_OPEN_PAIR);
            }

            $request = new RepairRequest([
                'requester_workspace_id' => $personal->id,
                'requester_user_id' => $user->id,
                'workshop_workspace_id' => $workshop->id,
                'vehicle_id' => $vehicle->id,
                'status' => RepairRequestStatus::Pending,
                // Copia fija: lo único que el taller verá del coche. Editar el coche después no la cambia.
                'vehicle_make' => $vehicle->make,
                'vehicle_model' => $vehicle->model,
                'vehicle_year' => $vehicle->year,
                'vehicle_fuel_type' => $vehicle->fuel_type,
                'vehicle_body_type' => $vehicle->body_type,
                'vehicle_color_hex' => $vehicle->color_hex,
                'vehicle_plate' => $vehicle->plate,
                'title' => $data['title'],
                'description' => $data['description'],
                'zone' => $data['zone'] ?? null,
                'preferred_date' => $data['preferred_date'],
                'mileage' => (int) $data['mileage'],
                'contact_phone' => $data['contact_phone'] ?? null,
                'share_history' => (bool) ($data['share_history'] ?? false),
            ]);
            $request->save();
            $request->setRelation('workshop', $workshop);

            $this->activity->log($personal->id, 'repair_request.created', 'repair_request', $request->id,
                "Enviaste una solicitud a {$workshop->name} para {$request->vehicleName()}", $vehicle->id);

            $this->notifier->toWorkshop($request, NotificationKind::RequestReceived,
                "Nueva solicitud para {$request->vehicleLabel()}: «{$request->title}»");

            return $request->fresh(RepairRequest::RESOURCE_RELATIONS);
        });
    }

    // ───────────────────────── Acciones del particular ─────────────────────────

    /** PATCH share_history: dar o retirar el consentimiento mientras la solicitud está abierta. */
    public function updateShareHistory(RepairRequest $request, bool $share): RepairRequest
    {
        return $this->locked($request, function (RepairRequest $r) use ($share) {
            $this->ensureOpen($r);
            $r->share_history = $share;
            $r->save();
        });
    }

    /** Cancelar mientras no sea una orden. Una versión `sent` pasa a `superseded`. */
    public function cancel(RepairRequest $request): RepairRequest
    {
        return $this->locked($request, function (RepairRequest $r) {
            if ($r->status === RepairRequestStatus::Converted) {
                $order = $r->workOrder()->value('number');
                throw new ConflictException($order
                    ? "Esta solicitud ya es la orden {$order}. Para cancelarla, llama al taller."
                    : 'Esta solicitud ya se convirtió en una orden del taller. Para cancelarla, llama al taller.');
            }
            $this->ensureOpen($r);

            $this->close($r, RepairRequestStatus::Cancelled);

            $this->activity->log($r->requester_workspace_id, 'repair_request.cancelled', 'repair_request', $r->id,
                "Cancelaste la solicitud a {$r->workshop->name} para {$r->vehicleName()}", $r->vehicle_id);
            $this->notifier->toWorkshop($r, NotificationKind::RequestCancelled,
                "El cliente canceló la solicitud de {$r->vehicleLabel()}");
        });
    }

    /**
     * El particular borra el coche (§3.3, §3.13.4): sus solicitudes abiertas se cancelan en la misma
     * transacción del borrado y se avisa al taller. El historial deja de verse porque el coche ya no existe.
     */
    public function cancelForDeletedVehicle(Vehicle $vehicle): void
    {
        $open = RepairRequest::query()->open()->where('vehicle_id', $vehicle->id)->lockForUpdate()->get();

        foreach ($open as $r) {
            $this->close($r, RepairRequestStatus::Cancelled);
            $this->notifier->toWorkshop($r, NotificationKind::RequestCancelled,
                "El cliente canceló la solicitud de {$r->vehicleLabel()}");
        }
    }

    /**
     * Aceptar el presupuesto vigente ⇒ conversión en orden (§3.13.6), todo en una transacción.
     * 409 si `quote_id` no es la versión `sent` o si está caducada.
     */
    public function acceptQuote(RepairRequest $request, int $quoteId): RepairRequest
    {
        return $this->locked($request, function (RepairRequest $r) use ($quoteId) {
            $quote = $this->currentQuote($r, $quoteId);
            if ($quote->isExpired()) {
                throw new ConflictException("El presupuesto caducó el {$quote->valid_until->format('d/m/Y')}. Pide al taller uno nuevo.");
            }

            $this->convert($r, $quote);
        });
    }

    /** Rechazar el presupuesto vigente (aunque haya caducado): la solicitud vuelve a `accepted`. */
    public function rejectQuote(RepairRequest $request, int $quoteId, ?string $reason): RepairRequest
    {
        return $this->locked($request, function (RepairRequest $r) use ($quoteId, $reason) {
            $quote = $this->currentQuote($r, $quoteId);

            $quote->forceFill([
                'status' => RepairQuoteStatus::Rejected,
                'client_reason' => $reason,
                'answered_at' => now(),
            ])->save();
            $r->status = RepairRequestStatus::Accepted;
            $r->save();

            $this->activity->log($r->requester_workspace_id, 'repair_quote.rejected', 'repair_quote', $quote->id,
                "Rechazaste el presupuesto de {$r->workshop->name} para {$r->vehicleName()}", $r->vehicle_id);
            $this->activity->logWithoutUser($r->workshop_workspace_id, 'repair_quote.rejected', 'repair_quote', $quote->id,
                "El cliente rechazó el presupuesto v{$quote->version} de {$r->vehicleLabel()}");
            $this->notifier->toWorkshop($r, NotificationKind::QuoteRejected,
                "El cliente rechazó el presupuesto v{$quote->version} de {$r->vehicleLabel()}");
        });
    }

    // ───────────────────────── Acciones del taller ─────────────────────────

    /** Aceptar sin presupuesto (⇒ accepted) o con presupuesto (⇒ quoted, versión 1). Solo desde `pending`. */
    public function accept(RepairRequest $request, ?array $quote): RepairRequest
    {
        return $this->locked($request, function (RepairRequest $r) use ($quote) {
            $this->ensureOpen($r);
            if ($r->status !== RepairRequestStatus::Pending) {
                throw new ConflictException(self::MSG_ALREADY_ANSWERED);
            }

            $r->responded_at = now();
            $this->activity->log($r->workshop_workspace_id, 'repair_request.accepted', 'repair_request', $r->id,
                ActivityLogger::actor()." aceptó la solicitud de {$r->vehicleLabel()}");

            if ($quote === null) {
                $r->status = RepairRequestStatus::Accepted;
                $r->save();
                $this->notifier->toRequester($r, NotificationKind::RequestAccepted,
                    "{$r->workshop->name} aceptó tu solicitud para {$r->vehicleName()}. El presupuesto llegará después");

                return;
            }

            $this->addQuote($r, $quote);
            $this->notifier->toRequester($r, NotificationKind::QuoteSent,
                "{$r->workshop->name} aceptó tu solicitud y te envió un presupuesto para {$r->vehicleName()}");
        });
    }

    /** Rechazar con motivo desde pending, accepted o quoted. Una versión `sent` pasa a `superseded`. */
    public function reject(RepairRequest $request, string $reason): RepairRequest
    {
        return $this->locked($request, function (RepairRequest $r) use ($reason) {
            $this->ensureOpen($r);

            $r->reject_reason = $reason;
            $r->responded_at ??= now();
            $this->close($r, RepairRequestStatus::Rejected);

            $this->activity->log($r->workshop_workspace_id, 'repair_request.rejected', 'repair_request', $r->id,
                ActivityLogger::actor()." rechazó la solicitud de {$r->vehicleLabel()}");
            $this->notifier->toRequester($r, NotificationKind::RequestRejected,
                "{$r->workshop->name} rechazó tu solicitud para {$r->vehicleName()}");
        });
    }

    /** Enviar una versión nueva desde accepted o quoted (la anterior `sent` pasa a `superseded`). */
    public function sendQuote(RepairRequest $request, array $quote): RepairRequest
    {
        return $this->locked($request, function (RepairRequest $r) use ($quote) {
            $this->ensureOpen($r);
            if ($r->status === RepairRequestStatus::Pending) {
                throw new ConflictException(self::MSG_NOT_ACCEPTED);
            }

            $this->addQuote($r, $quote);
            $this->notifier->toRequester($r, NotificationKind::QuoteSent,
                "{$r->workshop->name} te envió un presupuesto para {$r->vehicleName()}");
        });
    }

    // ───────────────────────── Historial compartido ─────────────────────────

    /**
     * Intervenciones no archivadas del coche del particular, sin importes, descripciones, líneas ni
     * documentos, como máximo 50. 403 si `history_available = false`.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function history(RepairRequest $request): Collection
    {
        if (! $request->historyAvailable()) {
            throw new ForbiddenException(self::MSG_NO_HISTORY);
        }

        return MaintenanceRecord::query()
            ->where('vehicle_id', $request->vehicle_id)
            ->whereNull('archived_at')
            ->orderByDesc('service_date')
            ->orderByDesc('id')
            ->limit(self::HISTORY_LIMIT)
            ->get(['id', 'service_date', 'type', 'zone', 'service_kind', 'title', 'mileage', 'workshop_name'])
            ->map(fn (MaintenanceRecord $record) => [
                'service_date' => $record->service_date->format('Y-m-d'),
                'type' => $record->type->value,
                'zone' => $record->zone->value,
                'service_kind' => $record->service_kind?->value,
                'title' => $record->title,
                'mileage' => $record->mileage,
                'workshop_name' => $record->workshop_name,
            ]);
    }

    // ───────────────────────── Internos ─────────────────────────

    /** Relee la solicitud con bloqueo de fila, aplica la transición y devuelve la solicitud fresca. */
    private function locked(RepairRequest $request, Closure $transition): RepairRequest
    {
        return DB::transaction(function () use ($request, $transition) {
            $locked = RepairRequest::query()->whereKey($request->getKey())->lockForUpdate()->firstOrFail();
            $locked->load('workshop');
            $transition($locked);

            return $locked->fresh(RepairRequest::RESOURCE_RELATIONS);
        });
    }

    private function ensureOpen(RepairRequest $r): void
    {
        if (! $r->isOpen()) {
            throw new ConflictException(self::MSG_CLOSED);
        }
    }

    /** Cierra la solicitud (rejected o cancelled): la versión `sent` pasa a `superseded` y se fija closed_at. */
    private function close(RepairRequest $r, RepairRequestStatus $status): void
    {
        $this->supersedeSent($r);
        $r->status = $status;
        $r->closed_at = now();
        $r->save();
    }

    private function supersedeSent(RepairRequest $r): void
    {
        RepairQuote::query()
            ->where('repair_request_id', $r->id)
            ->where('status', RepairQuoteStatus::Sent->value)
            ->update(['status' => RepairQuoteStatus::Superseded->value, 'updated_at' => now()]);
    }

    /**
     * La versión vigente si es la que el cliente está viendo. 409 si la solicitud está cerrada, si no hay
     * presupuesto pendiente o si `quote_id` no es la versión `sent`.
     */
    private function currentQuote(RepairRequest $r, int $quoteId): RepairQuote
    {
        $this->ensureOpen($r);

        $sent = RepairQuote::query()
            ->where('repair_request_id', $r->id)
            ->where('status', RepairQuoteStatus::Sent->value)
            ->lockForUpdate()
            ->first();

        if ($r->status !== RepairRequestStatus::Quoted || $sent === null) {
            throw new ConflictException(self::MSG_NO_QUOTE);
        }
        if ($sent->id !== $quoteId) {
            throw new ConflictException(self::MSG_STALE_QUOTE);
        }

        return $sent;
    }

    /**
     * Versión n+1 inmutable: líneas con su total, totales con las reglas de las órdenes (§3.11) y validez.
     * La anterior `sent` pasa a `superseded`. La solicitud queda en `quoted`.
     */
    private function addQuote(RepairRequest $r, array $data): RepairQuote
    {
        $this->supersedeSent($r);

        $rows = LineItems::rows($data['items']);
        $items = array_map(fn (array $row) => Arr::only($row, ['kind', 'name', 'part_number', 'quantity', 'unit_price', 'total']), $rows);
        $subtotal = LineItems::sumCents($rows) ?? 0;
        $taxRate = Money::normalize($data['tax_rate'] ?? null) ?? $r->workshop->taxRate();
        $tax = Money::percentOf($subtotal, $taxRate);
        $validDays = (int) ($data['valid_days'] ?? self::DEFAULT_VALID_DAYS);

        $quote = RepairQuote::create([
            'repair_request_id' => $r->id,
            'version' => (int) RepairQuote::query()->where('repair_request_id', $r->id)->max('version') + 1,
            'status' => RepairQuoteStatus::Sent,
            'items' => $items,
            'subtotal' => Money::format($subtotal),
            'tax_rate' => $taxRate,
            'tax_amount' => Money::format($tax),
            'total' => Money::format($subtotal + $tax),
            'valid_days' => $validDays,
            'valid_until' => today()->addDays($validDays)->toDateString(),
            'note' => $data['note'] ?? null,
            'sent_at' => now(),
        ]);

        $r->status = RepairRequestStatus::Quoted;
        $r->save();

        $this->activity->log($r->workshop_workspace_id, 'repair_quote.sent', 'repair_quote', $quote->id,
            ActivityLogger::actor()." envió el presupuesto v{$quote->version} de {$r->vehicleLabel()}");

        return $quote;
    }

    /** §3.13.6: cliente, vehículo y orden del taller; la versión pasa a `accepted` y la solicitud a `converted`. */
    private function convert(RepairRequest $r, RepairQuote $quote): void
    {
        $workshop = $r->workshop;
        $customer = $this->customerFor($r, $workshop);
        $vehicle = $this->workshopVehicleFor($r, $workshop, $customer);

        $order = $this->orders->createFromRepairRequest($workshop, [
            'vehicle_id' => $vehicle->id,
            'title' => $r->title,
            'complaint' => $r->description,
            'diagnosis' => null,
            'priority' => Priority::Normal->value,
            'mileage_in' => $r->mileage,
            'tax_rate' => $quote->tax_rate,
            'items' => $quote->items,
        ], $customer->id);

        $quote->forceFill(['status' => RepairQuoteStatus::Accepted, 'answered_at' => now()])->save();
        $r->forceFill([
            'status' => RepairRequestStatus::Converted,
            'closed_at' => now(),
            'customer_id' => $customer->id,
            'work_order_id' => $order->id,
        ])->save();

        $this->activity->log($r->requester_workspace_id, 'repair_quote.accepted', 'repair_quote', $quote->id,
            "Aceptaste el presupuesto de {$workshop->name} para {$r->vehicleName()}", $r->vehicle_id);
        $this->activity->logWithoutUser($workshop->id, 'repair_quote.accepted', 'repair_quote', $quote->id,
            "El cliente aceptó el presupuesto v{$quote->version} de {$r->vehicleLabel()}");
        $this->notifier->toWorkshop($r, NotificationKind::QuoteAccepted,
            "El cliente aceptó el presupuesto de {$r->vehicleLabel()}: se abrió {$order->number}");
    }

    /**
     * Cliente del taller: el de la última solicitud convertida de este usuario en este taller, si existe y no
     * está anonimizado. Si no, uno nuevo con su nombre, su email y el teléfono de contacto.
     * NUNCA se busca por email (ADR‑0007): un email no verificado no enlaza con datos que escribió el taller.
     */
    private function customerFor(RepairRequest $r, Workspace $workshop): Customer
    {
        $previousCustomerId = RepairRequest::query()
            ->where('workshop_workspace_id', $workshop->id)
            ->where('requester_user_id', $r->requester_user_id)
            ->where('status', RepairRequestStatus::Converted->value)
            ->whereKeyNot($r->id)
            ->orderByDesc('closed_at')
            ->orderByDesc('id')
            ->value('customer_id');

        $previous = $previousCustomerId === null ? null
            : Customer::query()->where('workspace_id', $workshop->id)->find($previousCustomerId);
        if ($previous !== null && ! $previous->isAnonymized()) {
            return $previous;
        }

        $requester = $r->requester()->firstOrFail();
        $customer = $workshop->customers()->create([
            'name' => $requester->name,
            'email' => $requester->email,
            'phone' => $r->contact_phone,
            'tax_id' => null,
            'notes' => null,
        ]);

        // Única frase con el nombre (como customer.created): se reescribe al anonimizar o eliminar (§3.10.1).
        $this->activity->logWithoutUser($workshop->id, 'customer.created', 'customer', $customer->id,
            "Se dio de alta al cliente {$customer->name} desde una solicitud");

        return $customer;
    }

    /**
     * Vehículo del taller, por orden de preferencia: (a) la copia enlazada al coche del particular;
     * (b) uno con la misma matrícula, al que se enlaza si no lo estaba (sin cambiarle el cliente);
     * (c) uno nuevo con la copia fija, el cliente del punto 1 y sin km (la lectura la crea la orden).
     */
    private function workshopVehicleFor(RepairRequest $r, Workspace $workshop, Customer $customer): Vehicle
    {
        $active = fn () => Vehicle::query()->where('workspace_id', $workshop->id)->whereNull('archived_at');

        if ($r->vehicle_id !== null) {
            $linked = $active()->where('source_vehicle_id', $r->vehicle_id)->orderByDesc('id')->first();
            if ($linked !== null) {
                return $linked;
            }
        }

        if ($r->vehicle_plate !== null) {
            $samePlate = $active()->where('plate', $r->vehicle_plate)->orderByDesc('id')->first();
            if ($samePlate !== null) {
                if ($samePlate->source_vehicle_id === null && $r->vehicle_id !== null) {
                    $samePlate->forceFill(['source_vehicle_id' => $r->vehicle_id])->save();
                }

                return $samePlate;
            }
        }

        $vehicle = new Vehicle([
            'workspace_id' => $workshop->id,
            'customer_id' => $customer->id,
            'make' => $r->vehicle_make,
            'model' => $r->vehicle_model,
            'year' => $r->vehicle_year,
            'fuel_type' => $r->vehicle_fuel_type,
            'body_type' => $r->vehicle_body_type,
            'color_hex' => $r->vehicle_color_hex,
            'plate' => $r->vehicle_plate,
        ]);
        $vehicle->forceFill(['source_vehicle_id' => $r->vehicle_id]);
        $vehicle->save();

        return $vehicle;
    }
}
