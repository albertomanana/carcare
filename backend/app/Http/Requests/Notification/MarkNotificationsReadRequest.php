<?php

namespace App\Http\Requests\Notification;

use App\Http\Requests\ApiRequest;

/** POST /notifications/read (`MarkNotificationsReadInput`): sin `ids`, todas; los ids ajenos se ignoran. */
class MarkNotificationsReadRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'ids' => ['sometimes', 'nullable', 'array', 'max:200'],
            'ids.*' => ['string', 'max:64'],
        ];
    }

    /** @return list<string>|null null ⇒ todas. */
    public function ids(): ?array
    {
        $ids = $this->validated('ids');

        return $ids === null ? null : array_values($ids);
    }
}
