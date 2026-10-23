<?php

namespace App\Http\Controllers\Workshop;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\CustomerRequest;
use App\Http\Requests\ListRequest;
use App\Http\Resources\CustomerResource;
use App\Http\Resources\VehicleResource;
use App\Models\Customer;
use App\Models\Workspace;
use App\Services\CustomerService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/** Clientes del taller (en espacios personales estas rutas responden 404). */
class CustomerController extends Controller
{
    public function __construct(private readonly CustomerService $customers) {}

    /** `?search=` en nombre, email, teléfono y NIF. */
    public function index(ListRequest $request, Workspace $workspace): AnonymousResourceCollection
    {
        $search = trim((string) $request->query('search', ''));

        $customers = $workspace->customers()
            ->when($search !== '', fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->where('name', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")
                ->orWhere('phone', 'like', "%{$search}%")
                ->orWhere('tax_id', 'like', "%{$search}%")))
            ->withCount(CustomerResource::eagerCount())
            ->orderBy('name')
            ->orderBy('id')
            ->paginate($this->perPage($request));

        return CustomerResource::collection($customers);
    }

    public function store(CustomerRequest $request, Workspace $workspace): JsonResponse
    {
        $customer = $this->customers->create($workspace, $request->validated());

        return (new CustomerResource($customer))->response()->setStatusCode(201);
    }

    public function show(Customer $customer): CustomerResource
    {
        return new CustomerResource($customer);
    }

    public function update(CustomerRequest $request, Customer $customer): CustomerResource
    {
        return new CustomerResource($this->customers->update($customer, $request->validated()));
    }

    /** 409 si tiene órdenes abiertas; sus vehículos quedan sin cliente. */
    public function destroy(Customer $customer): Response
    {
        $this->customers->delete($customer);

        return $this->noContent();
    }

    /** Vehículos activos del cliente. */
    public function vehicles(Customer $customer): AnonymousResourceCollection
    {
        return VehicleResource::collection(
            $customer->vehicles()->whereNull('archived_at')
                ->with(VehicleResource::eagerLoad())->withCount(VehicleResource::eagerCount())
                ->orderByDesc('created_at')->orderByDesc('id')->get()
        );
    }
}
