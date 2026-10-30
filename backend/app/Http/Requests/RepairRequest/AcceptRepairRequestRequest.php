<?php

namespace App\Http\Requests\RepairRequest;

use App\Http\Requests\ApiRequest;

/**
 * POST /repair-requests/{r}/accept (`AcceptRepairRequestInput`). Sin `quote` (o null) ⇒ `accepted`;
 * con `quote` ⇒ `quoted` con la versión 1, validada como `RepairQuoteInput` con las claves `quote.items.0…`.
 */
class AcceptRepairRequestRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'quote' => ['sometimes', 'nullable', 'array'],
            ...($this->withQuote() ? RepairQuoteRequest::quoteRules('quote.') : []),
        ];
    }

    public function messages(): array
    {
        return RepairQuoteRequest::quoteMessages('quote.');
    }

    public function quote(): ?array
    {
        return $this->withQuote() ? $this->validated('quote') : null;
    }

    private function withQuote(): bool
    {
        return is_array($this->input('quote'));
    }
}
