<?php

namespace App\Services;

use App\Models\Document;
use App\Models\Vehicle;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Documentos en disco PRIVADO (storage/app/private/documents/{workspace}/{uuid}.{ext}).
 * Nunca en public/: solo se descargan por el controlador autorizado.
 */
class DocumentService
{
    public const DISK = 'local';

    private const EXTENSIONS = [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    public function __construct(private readonly ActivityLogger $activity) {}

    public function store(Vehicle $vehicle, UploadedFile $file, array $data): Document
    {
        $mime = $file->getMimeType() ?? 'application/octet-stream'; // MIME real (fileinfo), no el del cliente
        $extension = self::EXTENSIONS[$mime] ?? 'bin';
        $path = $file->storeAs("documents/{$vehicle->workspace_id}", Str::uuid().'.'.$extension, self::DISK);

        try {
            return DB::transaction(function () use ($vehicle, $file, $data, $mime, $path) {
                $document = $vehicle->documents()->create([
                    'maintenance_record_id' => $data['maintenance_record_id'] ?? null,
                    'title' => $data['title'],
                    'document_type' => $data['document_type'],
                    'disk' => self::DISK,
                    'path' => $path,
                    'original_filename' => self::sanitizeFilename($file->getClientOriginalName()),
                    'mime_type' => $mime,
                    'size' => $file->getSize(),
                    'expires_at' => $data['expires_at'] ?? null,
                ]);

                $this->activity->forVehicle($vehicle, 'document.uploaded', 'document', $document->id,
                    ActivityLogger::actor()." subió el documento «{$document->title}» a ".$vehicle->displayName(),
                    ['document_type' => $document->document_type->value]);

                return $document;
            });
        } catch (\Throwable $e) {
            Storage::disk(self::DISK)->delete($path);
            throw $e;
        }
    }

    public function delete(Document $document): void
    {
        $vehicle = $document->vehicle;

        DB::transaction(function () use ($document, $vehicle) {
            $document->delete();
            $this->activity->forVehicle($vehicle, 'document.deleted', 'document', $document->id,
                ActivityLogger::actor()." eliminó el documento «{$document->title}» de ".$vehicle->displayName());
        });

        Storage::disk($document->disk)->delete($document->path);
    }

    /** Nombre original apto para mostrar y para Content-Disposition (sin rutas ni caracteres de control). */
    public static function sanitizeFilename(string $name): string
    {
        $name = basename(str_replace('\\', '/', $name));
        $name = preg_replace('/[\x00-\x1F\x7F"<>:|?*\/\\\\]+/u', '_', $name) ?? 'documento';
        $name = trim($name, " .\t");

        return $name === '' ? 'documento' : mb_substr($name, 0, 200);
    }
}
