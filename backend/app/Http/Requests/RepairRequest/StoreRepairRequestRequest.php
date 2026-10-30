<?php

namespace App\Http\Requests\RepairRequest;

use App\Enums\Zone;
use App\Http\Requests\ApiRequest;
use App\Http\Requests\Directory\DirectoryProfileRequest;
use App\Models\Vehicle;
use App\Models\Workspace;
use App\Support\Km;
use Closure;
use Illuminate\Validation\Rule;

/**
 * POST /workspaces/{ws}/repair-requests (`RepairRequestInput`, contrato §3.13.3). 422 con el campo:
 *  - vehicle_id: un coche de este garaje y sin archivar;
 *  - workshop_id: un taller del directorio del que el usuario no es miembro;
 *  - mileage: ≥ el último kilometraje anotado (sin `confirm_mileage_drop`).
 * Los límites anti‑spam (429 y 409) los aplica RepairRequestService.
 */
class StoreRepairRequestRequest extends ApiRequest
{
    public const PREFERRED_DATE_MAX_DAYS = 180;

    private ?Vehicle $vehicle = null;

    private ?Workspace $workshop = null;

    protected function prepareForValidation(): void
    {
        foreach (['title', 'description', 'contact_phone'] as $field) {
            if (is_string($this->input($field))) {
                $value = trim($this->input($field));
                $this->merge([$field => $value === '' && $field === 'contact_phone' ? null : $value]);
            }
        }
    }

    public function rules(): array
    {
        $maxDate = today()->addDays(self::PREFERRED_DATE_MAX_DAYS)->toDateString();

        return [
            'vehicle_id' => ['bail', 'required', 'integer', $this->checkVehicle(...)],
            'workshop_id' => ['bail', 'required', 'integer', $this->checkWorkshop(...)],
            'title' => ['required', 'string', 'min:3', 'max:120'],
            'description' => ['required', 'string', 'min:10', 'max:2000'],
            'zone' => ['sometimes', 'nullable', Rule::enum(Zone::class)],
            'preferred_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:today', 'before_or_equal:'.$maxDate],
            'mileage' => ['bail', 'required', ...self::km(), $this->checkMileage(...)],
            'contact_phone' => ['sometimes', 'nullable', 'string', 'max:30', 'regex:'.DirectoryProfileRequest::PHONE_REGEX],
            'share_history' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'preferred_date.after_or_equal' => 'La fecha preferida no puede ser anterior a hoy.',
            'preferred_date.before_or_equal' => 'La fecha preferida no puede ser posterior a dentro de '.self::PREFERRED_DATE_MAX_DAYS.' días.',
            'contact_phone.regex' => DirectoryProfileRequest::PHONE_MESSAGE,
        ];
    }

    /** El coche validado (de este garaje y sin archivar). */
    public function vehicle(): Vehicle
    {
        return $this->vehicle ??= $this->findVehicle();
    }

    /** El taller validado (en el directorio y sin ser miembro). */
    public function workshop(): Workspace
    {
        return $this->workshop ??= Workspace::query()->findOrFail($this->validated('workshop_id'));
    }

    public function payload(): array
    {
        $data = $this->validated();
        $data['share_history'] = $this->boolean('share_history');

        return $data;
    }

    private function findVehicle(): ?Vehicle
    {
        /** @var Workspace $workspace */
        $workspace = $this->route('workspace');

        return Vehicle::query()->where('workspace_id', $workspace->id)->find((int) $this->input('vehicle_id'));
    }

    private function checkVehicle(string $attribute, mixed $value, Closure $fail): void
    {
        $vehicle = $this->vehicle = $this->findVehicle();

        if ($vehicle === null) {
            $fail('Este vehículo no está en tu garaje.');
        } elseif ($vehicle->isArchived()) {
            $fail('Este vehículo está archivado.');
        }
    }

    private function checkWorkshop(string $attribute, mixed $value, Closure $fail): void
    {
        $workshop = Workspace::query()->with('workshopProfile')->find((int) $value);

        if ($workshop === null || ! $workshop->isWorkshop() || $workshop->workshopProfile?->listed !== true) {
            $fail('Este taller no está en el directorio.');
        } elseif ($this->user()->roleIn($workshop) !== null) {
            $fail('No puedes enviar una solicitud a un taller del que formas parte.');
        }
    }

    /** Los km declarados no pueden ser menores que el último kilometraje anotado del coche. */
    private function checkMileage(string $attribute, mixed $value, Closure $fail): void
    {
        $current = ($this->vehicle ?? $this->findVehicle())?->current_mileage;

        if ($current !== null && (int) $value < $current) {
            $fail('No puede ser menor que el último kilometraje anotado ('.Km::human($current).').');
        }
    }
}
