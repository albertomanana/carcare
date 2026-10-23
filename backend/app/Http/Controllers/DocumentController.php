<?php

namespace App\Http\Controllers;

use App\Http\Requests\Document\StoreDocumentRequest;
use App\Http\Requests\ListRequest;
use App\Http\Resources\DocumentResource;
use App\Models\Document;
use App\Models\Vehicle;
use App\Services\DocumentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Documentos del vehículo en disco privado; se descargan solo por este controlador autorizado. */
class DocumentController extends Controller
{
    public function __construct(private readonly DocumentService $documents) {}

    public function index(ListRequest $request, Vehicle $vehicle): AnonymousResourceCollection
    {
        $documents = $vehicle->documents()
            ->when($request->filled('document_type'), fn ($q) => $q->where('document_type', $request->query('document_type')))
            ->when($request->filled('maintenance_record_id'), fn ($q) => $q->where('maintenance_record_id', (int) $request->query('maintenance_record_id')))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        return DocumentResource::collection($documents);
    }

    public function store(StoreDocumentRequest $request, Vehicle $vehicle): JsonResponse
    {
        $document = $this->documents->store($vehicle, $request->file('file'), $request->safe()->except('file'));

        return (new DocumentResource($document))->response()->setStatusCode(201);
    }

    /** attachment por defecto; `?inline=1` lo muestra en el navegador (todos los tipos admitidos son PDF o imagen). */
    public function download(Request $request, Document $document): StreamedResponse
    {
        $disk = Storage::disk($document->disk);
        abort_unless($disk->exists($document->path), 404);

        $disposition = $request->boolean('inline') ? 'inline' : 'attachment';

        return $disk->response($document->path, $document->original_filename, [
            'Content-Type' => $document->mime_type,
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ], $disposition);
    }

    public function destroy(Document $document): Response
    {
        $this->documents->delete($document);

        return $this->noContent();
    }
}
