<?php

namespace App\Http\Requests\RepairRequest;

use App\Http\Requests\ApiRequest;

/** PATCH /repair-requests/{r} (`RepairRequestUpdateInput`): dar o retirar el consentimiento del historial. */
class UpdateRepairRequestRequest extends ApiRequest
{
    public function rules(): array
    {
        return ['share_history' => ['required', 'boolean']];
    }
}
