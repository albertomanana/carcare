<?php

namespace App\Http\Requests\Notification;

use App\Http\Requests\ApiRequest;

/** GET /notifications: `unread=1` (solo las no leídas) y paginación (20 por defecto, 50 como máximo). */
class NotificationIndexRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'unread' => ['sometimes', 'nullable', 'boolean'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1'],
        ];
    }
}
