<?php

use App\Models\Document;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('local');
    $this->user = makeUser();
    loginAs($this->user);
    $this->vehicle = makeVehicle($this->user->personalWorkspace());
    $this->base = "/api/v1/vehicles/{$this->vehicle->id}/documents";
});

/**
 * Fichero subido REAL (no `UploadedFile::fake()`, que informa el MIME por la extensión):
 * su MIME se detecta por contenido con fileinfo, como en producción.
 */
function upload(string $name, string $content): UploadedFile
{
    $path = tempnam(sys_get_temp_dir(), 'carcare');
    file_put_contents($path, $content);

    return new UploadedFile($path, $name, null, null, true);
}

function pdf(string $name = 'factura.pdf'): UploadedFile
{
    return upload($name, "%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n");
}

it('sube un PDF al disco privado con nombre UUID y lo lista', function () {
    $response = $this->post($this->base, [
        'file' => pdf('../../Factura taller "enero".pdf'), 'title' => 'Factura de enero', 'document_type' => 'invoice', 'expires_at' => day(300),
    ], ['Accept' => 'application/json'])->assertCreated();

    $document = Document::findOrFail($response->json('data.id'));
    $response->assertJsonPath('data.mime_type', 'application/pdf')
        ->assertJsonPath('data.download_url', "/api/v1/documents/{$document->id}/download")
        ->assertJsonPath('data.expires_at', day(300))
        ->assertJsonMissingPath('data.path');

    expect($document->path)->toMatch('#^documents/'.$this->vehicle->workspace_id.'/[0-9a-f-]{36}\.pdf$#')
        ->and($document->original_filename)->toBe('Factura taller _enero_.pdf');
    Storage::disk('local')->assertExists($document->path);

    $this->getJson($this->base)->assertJsonCount(1, 'data');
    $this->getJson("{$this->base}?document_type=photo")->assertJsonCount(0, 'data');
});

it('descarga con cabeceras seguras (attachment o inline)', function () {
    $id = $this->post($this->base, ['file' => pdf(), 'title' => 'Factura', 'document_type' => 'invoice'], ['Accept' => 'application/json'])->json('data.id');

    $download = $this->get("/api/v1/documents/{$id}/download")->assertOk();
    expect($download->headers->get('Content-Disposition'))->toStartWith('attachment')->toContain('factura.pdf')
        ->and($download->headers->get('X-Content-Type-Options'))->toBe('nosniff')
        ->and($download->headers->get('Content-Type'))->toBe('application/pdf');

    $inline = $this->get("/api/v1/documents/{$id}/download?inline=1")->assertOk();
    expect($inline->headers->get('Content-Disposition'))->toStartWith('inline');
});

it('rechaza archivos que no son PDF ni imagen aunque se llamen .pdf', function () {
    $fake = upload('virus.pdf', "#!/bin/sh\necho hola\n");

    $this->post($this->base, ['file' => $fake, 'title' => 'Malo', 'document_type' => 'other'], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.file.0', 'Solo se admiten archivos PDF, JPEG, PNG o WebP.');
});

it('rechaza archivos de más de 10 MB y vínculos a intervenciones de otro vehículo', function () {
    $other = makeVehicle($this->user->personalWorkspace());
    $record = $other->maintenanceRecords()->create(['type' => 'repair', 'zone' => 'body', 'title' => 'Otro', 'service_date' => day()]);

    $this->post($this->base, [
        'file' => UploadedFile::fake()->create('grande.pdf', 11 * 1024, 'application/pdf'),
        'title' => 'Grande', 'document_type' => 'manual', 'maintenance_record_id' => $record->id,
    ], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['file', 'maintenance_record_id'])
        ->assertJsonPath('errors.maintenance_record_id.0', 'La intervención no pertenece a este vehículo.');
});

it('filtra por intervención vinculada y la intervención cuenta sus documentos', function () {
    $record = $this->vehicle->maintenanceRecords()->create(['type' => 'repair', 'zone' => 'brakes', 'title' => 'Frenos', 'service_date' => day(-1)]);
    $linked = $this->post($this->base, [
        'file' => pdf(), 'title' => 'Factura frenos', 'document_type' => 'invoice', 'maintenance_record_id' => $record->id,
    ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.maintenance_record_id', $record->id)->json('data.id');
    $this->post($this->base, ['file' => pdf(), 'title' => 'Permiso de circulación', 'document_type' => 'registration'], ['Accept' => 'application/json'])
        ->assertCreated()->assertJsonPath('data.maintenance_record_id', null);

    $this->getJson($this->base)->assertJsonCount(2, 'data');
    $this->getJson("{$this->base}?maintenance_record_id={$record->id}")->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $linked);
    $this->getJson("{$this->base}?maintenance_record_id=x")->assertUnprocessable()->assertJsonValidationErrors('maintenance_record_id');
    $this->getJson("/api/v1/maintenance/{$record->id}")->assertJsonPath('data.documents_count', 1);
});

it('borra el documento y su fichero', function () {
    $id = $this->post($this->base, ['file' => pdf(), 'title' => 'Factura', 'document_type' => 'invoice'], ['Accept' => 'application/json'])->json('data.id');
    $path = Document::findOrFail($id)->path;

    $this->deleteJson("/api/v1/documents/{$id}")->assertNoContent();
    Storage::disk('local')->assertMissing($path);
    $this->get("/api/v1/documents/{$id}/download")->assertNotFound();
});
