<?php

namespace App\Http\Controllers;

use App\Http\Requests\Reminder\CompleteReminderRequest;
use App\Http\Requests\Reminder\ReminderIndexRequest;
use App\Http\Requests\Reminder\ReminderRequest;
use App\Http\Resources\ReminderResource;
use App\Models\Reminder;
use App\Models\Vehicle;
use App\Services\ReminderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/** Recordatorios y vencimientos de un vehículo. */
class ReminderController extends Controller
{
    public function __construct(private readonly ReminderService $reminders) {}

    /** `?status=pending|done|dismissed|all` (def. pending). Orden: overdue, soon, ok, unknown; luego fecha. */
    public function index(ReminderIndexRequest $request, Vehicle $vehicle): AnonymousResourceCollection
    {
        $status = $request->query('status', 'pending');

        $reminders = $vehicle->reminders()
            ->when($status !== 'all', fn ($q) => $q->where('status', $status))
            ->get()
            ->each(fn (Reminder $r) => $r->setRelation('vehicle', $vehicle));

        return ReminderResource::collection(Reminder::sortByUrgency($reminders));
    }

    public function store(ReminderRequest $request, Vehicle $vehicle): JsonResponse
    {
        $reminder = $this->reminders->create($vehicle, $request->validated());

        return (new ReminderResource($reminder))->response()->setStatusCode(201);
    }

    public function update(ReminderRequest $request, Reminder $reminder): ReminderResource
    {
        return new ReminderResource($this->reminders->update($reminder, $request->validated()));
    }

    public function destroy(Reminder $reminder): Response
    {
        $this->reminders->delete($reminder);

        return $this->noContent();
    }

    /** `{ data: { completed, next } }`: si hay recurrencia (y create_next ≠ false) crea el siguiente. */
    public function complete(CompleteReminderRequest $request, Reminder $reminder): JsonResponse
    {
        $result = $this->reminders->complete($reminder, $request->validated());

        return $this->data([
            'completed' => new ReminderResource($result['completed']),
            'next' => $result['next'] ? new ReminderResource($result['next']) : null,
        ]);
    }

    public function dismiss(Reminder $reminder): ReminderResource
    {
        return new ReminderResource($this->reminders->dismiss($reminder));
    }
}
