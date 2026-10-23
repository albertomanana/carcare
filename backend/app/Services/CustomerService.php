<?php

namespace App\Services;

use App\Exceptions\ConflictException;
use App\Models\Customer;
use App\Models\Workspace;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class CustomerService
{
    private const FIELDS = ['name', 'email', 'phone', 'tax_id', 'notes'];

    public function __construct(private readonly ActivityLogger $activity) {}

    public function create(Workspace $workspace, array $data): Customer
    {
        return DB::transaction(function () use ($workspace, $data) {
            $customer = $workspace->customers()->create(Arr::only($data, self::FIELDS));

            $this->activity->log($workspace->id, 'customer.created', 'customer', $customer->id,
                ActivityLogger::actor()." dio de alta al cliente {$customer->name}");

            return $customer;
        });
    }

    public function update(Customer $customer, array $data): Customer
    {
        $customer->fill(Arr::only($data, self::FIELDS))->save();

        return $customer;
    }

    /** 409 si tiene órdenes abiertas. Sus vehículos quedan sin cliente (FK nullOnDelete). */
    public function delete(Customer $customer): void
    {
        if ($customer->workOrders()->open()->exists()) {
            throw new ConflictException('No se puede eliminar un cliente con órdenes de trabajo abiertas.');
        }

        $customer->delete();
    }
}
