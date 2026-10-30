<?php

namespace App\Http\Requests\RepairRequest;

use App\Http\Requests\ApiRequest;

/**
 * POST /repair-requests/{r}/quote/accept|reject (`QuoteDecisionInput`): `quote_id` es la versión que el
 * cliente está viendo (si ya no es la vigente, 409). `reason` (≤ 500) solo cuenta al rechazar.
 */
class QuoteDecisionRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('reason'))) {
            $reason = trim($this->input('reason'));
            $this->merge(['reason' => $reason === '' ? null : $reason]);
        }
    }

    public function rules(): array
    {
        return [
            'quote_id' => ['required', 'integer'],
            'reason' => ['sometimes', 'nullable', 'string', 'max:500'],
        ];
    }

    public function quoteId(): int
    {
        return (int) $this->validated('quote_id');
    }

    public function reason(): ?string
    {
        return $this->validated('reason');
    }
}
