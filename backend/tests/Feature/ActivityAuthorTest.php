<?php

use App\Models\Activity;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/*
 * Contrato §3.12 (petición 9, hallazgo M5 de UX): autor de la frase según el tipo de espacio.
 *  - `personal`: segunda persona y sin el nombre ("Anotaste 54.000 km en Kia Sportage").
 *  - `workshop`: empieza por el nombre de quien lo hizo ("Lucía Autora registró 54.000 km en Kia Sportage").
 * `Activity.user` llega igual en los dos casos: la forma JSON no cambia.
 */

/** Hace por la API, en $workspace, 20 acciones que cubren los 18 tipos de frase que existen en un garaje personal. */
function everyVehicleAction(Workspace $workspace): void
{
    Storage::fake('local');
    $t = test();

    $v = '/api/v1/vehicles/'.$t->postJson("/api/v1/workspaces/{$workspace->id}/vehicles", ['make' => 'Kia', 'model' => 'Sportage'])
        ->assertCreated()->json('data.id');
    $t->patchJson($v, ['year' => 2020])->assertOk();
    $t->postJson("{$v}/mileage", ['recorded_at' => day(-3), 'mileage' => 54000])->assertCreated();

    $record = '/api/v1/maintenance/'.$t->postJson("{$v}/maintenance", [
        'type' => 'maintenance', 'zone' => 'engine', 'title' => 'Cambio de aceite', 'service_date' => day(-2),
    ])->assertCreated()->json('data.id');
    $t->patchJson($record, ['description' => 'Aceite 5W30'])->assertOk();
    $t->postJson("{$record}/archive")->assertOk();
    $t->postJson("{$record}/restore")->assertOk();

    $expense = '/api/v1/expenses/'.$t->postJson("{$v}/expenses", ['category' => 'fuel', 'amount' => '45.00', 'expense_date' => day(-1)])
        ->assertCreated()->json('data.id');
    $t->patchJson($expense, ['amount' => '46.00'])->assertOk();
    $t->deleteJson($expense)->assertNoContent();

    $done = $t->postJson("{$v}/reminders", ['title' => 'ITV', 'kind' => 'itv', 'due_date' => day(30)])->assertCreated()->json('data.id');
    $t->postJson("/api/v1/reminders/{$done}/complete", ['completed_at' => day()])->assertOk();
    $dismissed = $t->postJson("{$v}/reminders", ['title' => 'Seguro', 'kind' => 'insurance', 'due_date' => day(30)])->assertCreated()->json('data.id');
    $t->postJson("/api/v1/reminders/{$dismissed}/dismiss")->assertOk();

    $pdf = tempnam(sys_get_temp_dir(), 'carcare');
    file_put_contents($pdf, "%PDF-1.4\n%prueba\n");
    $document = $t->post("{$v}/documents", [
        'file' => new UploadedFile($pdf, 'factura.pdf', null, null, true), 'title' => 'Factura', 'document_type' => 'invoice',
    ], ['Accept' => 'application/json'])->assertCreated()->json('data.id');
    $t->deleteJson("/api/v1/documents/{$document}")->assertNoContent();

    $t->postJson("{$v}/archive")->assertOk();
    $t->postJson("{$v}/restore")->assertOk();
    $t->postJson("{$v}/archive")->assertOk();
    $t->deleteJson($v)->assertNoContent();
}

function authorUser(): User
{
    $user = makeUser('Lucía Autora', 'Taller Lucía');
    loginAs($user);

    return $user;
}

it('en un espacio personal la frase va en segunda persona y no lleva el nombre del usuario', function () {
    $user = authorUser();
    $pws = $user->personalWorkspace();

    everyVehicleAction($pws);

    $summaries = Activity::query()->where('workspace_id', $pws->id)->orderBy('id')->pluck('summary');
    expect($summaries)->toHaveCount(20);
    foreach ($summaries as $summary) {
        expect($summary)->not->toContain('Lucía')->not->toContain('Autora')
            ->toMatch('/^(Añadiste|Editaste|Anotaste|Registraste|Archivaste|Restauraste|Eliminaste|Creaste|Completaste|Descartaste|Subiste) /u');
    }

    // Los tres ejemplos del contrato, al pie de la letra.
    expect($summaries->all())->toContain(
        'Anotaste 54.000 km en Kia Sportage',
        'Registraste la intervención «Cambio de aceite» en Kia Sportage',
        'Añadiste un gasto de 45,00 € (Combustible) en Kia Sportage',
        'Añadiste el vehículo Kia Sportage',
        'Completaste el recordatorio «ITV» de Kia Sportage',
        'Eliminaste el vehículo Kia Sportage',
    );
});

it('en un taller la frase empieza por el nombre de quien lo hizo', function () {
    $user = authorUser();
    $wws = workshopOf($user);

    everyVehicleAction($wws);

    $summaries = Activity::query()->where('workspace_id', $wws->id)->orderBy('id')->pluck('summary');
    expect($summaries)->toHaveCount(20);
    foreach ($summaries as $summary) {
        expect($summary)->toStartWith('Lucía Autora ');
    }
    expect($summaries->all())->toContain(
        'Lucía Autora registró 54.000 km en Kia Sportage',
        'Lucía Autora registró la intervención «Cambio de aceite» en Kia Sportage',
        'Lucía Autora añadió un gasto de 45,00 € (Combustible) en Kia Sportage',
    );
});

it('Activity.user llega igual en los dos tipos de espacio', function () {
    $user = authorUser();
    $pws = $user->personalWorkspace();
    $this->postJson("/api/v1/workspaces/{$pws->id}/vehicles", ['make' => 'Kia', 'model' => 'Sportage'])->assertCreated();

    $this->getJson("/api/v1/workspaces/{$pws->id}/activity")
        ->assertOk()
        ->assertJsonPath('data.0.summary', 'Añadiste el vehículo Kia Sportage')
        ->assertJsonPath('data.0.user', ['id' => $user->id, 'name' => 'Lucía Autora']);
});
