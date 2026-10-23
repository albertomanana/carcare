<?php

namespace App\Http\Requests\Reminder;

use App\Enums\ReminderState;
use App\Http\Requests\ApiRequest;
use Illuminate\Validation\Rule;

/**
 * GET /vehicles/{v}/reminders (`?status=pending|done|dismissed|all`) y
 * GET /workspaces/{ws}/reminders (`?state=overdue|soon|ok|unknown`).
 */
class ReminderIndexRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'status' => ['sometimes', 'in:pending,done,dismissed,all'],
            'state' => ['sometimes', 'nullable', Rule::enum(ReminderState::class)],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1'],
        ];
    }

    public function messages(): array
    {
        return ['status.in' => 'El estado debe ser pending, done, dismissed o all.'];
    }
}
