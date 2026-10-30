<?php

namespace App\Http\Resources;

use App\Models\RepairQuote;
use Illuminate\Http\Request;

/**
 * Versión de un presupuesto (`RepairQuote`, contrato §3.13.5). "No es una factura" (D12).
 * Las líneas salen tal cual se guardaron (con `total` calculado en el servidor) y sin `id`.
 */
class RepairQuoteResource extends ApiResource
{
    public function toArray(Request $request): array
    {
        /** @var RepairQuote $quote */
        $quote = $this->resource;

        return [
            'id' => $quote->id,
            'version' => $quote->version,
            'status' => $quote->status->value,
            'items' => array_map(fn (array $item) => [
                'kind' => $item['kind'],
                'name' => $item['name'],
                'part_number' => $item['part_number'] ?? null,
                'quantity' => $item['quantity'],
                'unit_price' => $item['unit_price'],
                'total' => $item['total'],
            ], $quote->items ?? []),
            'subtotal' => $quote->subtotal,
            'tax_rate' => $quote->tax_rate,
            'tax_amount' => $quote->tax_amount,
            'total' => $quote->total,
            'valid_days' => $quote->valid_days,
            'valid_until' => self::date($quote->valid_until),
            'is_expired' => $quote->isExpired(),
            'note' => $quote->note,
            'client_reason' => $quote->client_reason,
            'sent_at' => self::iso($quote->sent_at),
            'answered_at' => self::iso($quote->answered_at),
        ];
    }
}
