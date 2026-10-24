<?php

namespace App\Http\Resources;

use App\Models\Customer;
use Illuminate\Http\Request;

/** @mixin Customer */
class CustomerResource extends ApiResource
{
    public function toArray(Request $request): array
    {
        /** @var Customer $customer */
        $customer = $this->resource;
        if (! array_key_exists('vehicles_count', $customer->getAttributes())) {
            $customer->loadCount(self::eagerCount());
        }

        return [
            'id' => $customer->id,
            'workspace_id' => $customer->workspace_id,
            'name' => $customer->name,
            'email' => $customer->email,
            'phone' => $customer->phone,
            'tax_id' => $customer->tax_id,
            'notes' => $customer->notes,
            'vehicles_count' => (int) $customer->vehicles_count,
            'open_orders_count' => (int) $customer->open_orders_count,
            'anonymized_at' => self::iso($customer->anonymized_at),
            'created_at' => self::iso($customer->created_at),
            'updated_at' => self::iso($customer->updated_at),
        ];
    }

    public static function eagerCount(): array
    {
        return [
            'vehicles' => fn ($q) => $q->whereNull('archived_at'),
            'workOrders as open_orders_count' => fn ($q) => $q->open(),
        ];
    }
}
