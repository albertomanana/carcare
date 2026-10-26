<?php

namespace App\Services;

use App\Exceptions\ConflictException;
use App\Http\Resources\CustomerResource;
use App\Http\Resources\VehicleResource;
use App\Http\Resources\WorkOrderResource;
use App\Models\Activity;
use App\Models\Customer;
use App\Models\WorkOrder;
use App\Models\Workspace;
use DateTimeInterface;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

/**
 * Clientes del taller, con los derechos RGPD del contrato §3.10.1 (ADR‑0005): exportar sus datos y
 * anonimizarlo. El nombre del cliente solo aparece en la frase de `customer.created`, y se quita de
 * ahí al anonimizarlo o eliminarlo.
 */
class CustomerService
{
    private const FIELDS = ['name', 'email', 'phone', 'tax_id', 'notes'];

    /** "{autor} dio de alta al cliente {nombre}": la única frase de actividad que lleva el nombre. */
    private const CREATED_PHRASE = ' dio de alta al cliente ';

    public function __construct(private readonly ActivityLogger $activity) {}

    public function create(Workspace $workspace, array $data): Customer
    {
        return DB::transaction(function () use ($workspace, $data) {
            $customer = $workspace->customers()->create(Arr::only($data, self::FIELDS));

            $this->activity->log($workspace->id, 'customer.created', 'customer', $customer->id,
                ActivityLogger::actor().self::CREATED_PHRASE.$customer->name);

            return $customer;
        });
    }

    /** 409 si está anonimizado: sus datos ya no se pueden editar. */
    public function update(Customer $customer, array $data): Customer
    {
        if ($customer->isAnonymized()) {
            throw new ConflictException('Este cliente está anonimizado: sus datos ya no se pueden editar.');
        }

        $customer->fill(Arr::only($data, self::FIELDS))->save();

        return $customer;
    }

    /**
     * 409 si tiene órdenes abiertas. Sus vehículos quedan sin cliente (FK nullOnDelete) y las frases
     * de actividad que lo nombraban se reescriben sin su nombre.
     */
    public function delete(Customer $customer): void
    {
        DB::transaction(function () use ($customer) {
            $customer = $this->lock($customer);

            if ($customer->workOrders()->open()->exists()) {
                throw new ConflictException('No se puede eliminar un cliente con órdenes de trabajo abiertas.');
            }

            $this->forgetNameInActivity($customer, 'eliminado');
            $customer->delete();
        });
    }

    /**
     * Copia de sus datos (`CustomerExport`): el cliente, todos sus vehículos (archivados incluidos) y todas
     * sus órdenes con sus líneas, de la más reciente a la más antigua. Deja rastro en la actividad.
     */
    public function export(Customer $customer): array
    {
        $vehicles = $customer->vehicles()
            ->with(VehicleResource::eagerLoad())
            ->withCount(VehicleResource::eagerCount())
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();
        $orders = $customer->workOrders()
            ->with(WorkOrder::RESOURCE_RELATIONS)
            ->orderByDesc('received_at')
            ->orderByDesc('id')
            ->get();

        $this->activity->log($customer->workspace_id, 'customer.exported', 'customer', $customer->id,
            ActivityLogger::actor().' exportó los datos de un cliente');

        return [
            'generated_at' => now()->format(DateTimeInterface::ATOM),
            'workspace' => ['id' => $customer->workspace->id, 'name' => $customer->workspace->name],
            'customer' => new CustomerResource($customer),
            'vehicles' => VehicleResource::collection($vehicles),
            'work_orders' => WorkOrderResource::collection($orders),
        ];
    }

    /**
     * Irreversible. Sobrescribe los datos personales (nombre "Cliente anonimizado"; email, teléfono, NIF
     * y notas a null) sin copiarlos a ninguna otra tabla, y conserva el id, los vínculos con vehículos y
     * órdenes y todo el historial técnico. 409 si ya lo está o si tiene órdenes abiertas.
     */
    public function anonymize(Customer $customer): Customer
    {
        return DB::transaction(function () use ($customer) {
            $customer = $this->lock($customer);

            if ($customer->isAnonymized()) {
                throw new ConflictException('Este cliente ya está anonimizado.');
            }
            if ($customer->workOrders()->open()->exists()) {
                throw new ConflictException('No se puede anonimizar un cliente con órdenes de trabajo abiertas. Entrégalas o cancélalas antes.');
            }

            $customer->forceFill([
                'name' => Customer::ANONYMIZED_NAME,
                'email' => null,
                'phone' => null,
                'tax_id' => null,
                'notes' => null,
                'anonymized_at' => now(),
            ])->save();

            $this->forgetNameInActivity($customer, 'anonimizado');
            $this->activity->log($customer->workspace_id, 'customer.anonymized', 'customer', $customer->id,
                ActivityLogger::actor().' anonimizó los datos de un cliente');

            return $customer;
        });
    }

    /**
     * Reescribe sin el nombre las frases de actividad del cliente. Hoy solo `customer.created` lo lleva:
     * "Ana dio de alta al cliente Juan Pérez" ⇒ "Ana dio de alta a un cliente (anonimizado)".
     * `customer.exported` y `customer.anonymized` nunca lo llevan y no se tocan.
     */
    private function forgetNameInActivity(Customer $customer, string $state): void
    {
        $activities = Activity::query()
            ->where('workspace_id', $customer->workspace_id)
            ->where('entity_type', 'customer')
            ->where('entity_id', $customer->id)
            ->where('action', 'customer.created')
            ->with('user:id,name')
            ->get();

        foreach ($activities as $activity) {
            $activity->update(['summary' => $this->authorOf($activity)." dio de alta a un cliente ({$state})"]);
        }
    }

    /** Autor tal como quedó escrito en la frase (o, si no se reconoce, el usuario actual de la actividad). */
    private function authorOf(Activity $activity): string
    {
        $position = mb_strpos($activity->summary, self::CREATED_PHRASE);

        if ($position !== false && $position > 0) {
            return mb_substr($activity->summary, 0, $position);
        }

        return $activity->user?->name ?? 'Alguien';
    }

    /** Relee el cliente con bloqueo de fila para que dos peticiones simultáneas no se pisen. */
    private function lock(Customer $customer): Customer
    {
        return Customer::query()->whereKey($customer->getKey())->lockForUpdate()->firstOrFail();
    }
}
