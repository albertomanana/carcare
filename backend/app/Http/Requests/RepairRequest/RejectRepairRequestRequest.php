<?php

namespace App\Http\Requests\RepairRequest;

use App\Http\Requests\ApiRequest;

/** POST /repair-requests/{r}/reject (`RejectRepairRequestInput`): motivo obligatorio de 5 a 500 caracteres. */
class RejectRepairRequestRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('reason'))) {
            $this->merge(['reason' => trim($this->input('reason'))]);
        }
    }

    public function rules(): array
    {
        return ['reason' => ['required', 'string', 'min:5', 'max:500']];
    }

    public function messages(): array
    {
        return ['reason.required' => 'Indica el motivo del rechazo.'];
    }
}
