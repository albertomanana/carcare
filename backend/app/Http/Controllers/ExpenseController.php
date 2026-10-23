<?php

namespace App\Http\Controllers;

use App\Http\Requests\Expense\ExpenseIndexRequest;
use App\Http\Requests\Expense\ExpenseRequest;
use App\Http\Resources\ExpenseResource;
use App\Models\Expense;
use App\Models\Vehicle;
use App\Services\ExpenseService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/** Gastos (permiso manage: owner en personal, owner/manager en talleres). */
class ExpenseController extends Controller
{
    public function __construct(private readonly ExpenseService $expenses) {}

    /** Desc por fecha. Filtros: from, to, category (lista por comas). */
    public function index(ExpenseIndexRequest $request, Vehicle $vehicle): AnonymousResourceCollection
    {
        $categories = $request->categories();

        $expenses = $vehicle->expenses()
            ->when($request->filled('from'), fn (Builder $q) => $q->where('expense_date', '>=', $request->query('from')))
            ->when($request->filled('to'), fn (Builder $q) => $q->where('expense_date', '<=', $request->query('to')))
            ->when($categories !== null, fn (Builder $q) => $q->whereIn('category', $categories))
            ->orderByDesc('expense_date')
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ExpenseResource::collection($expenses);
    }

    public function store(ExpenseRequest $request, Vehicle $vehicle): JsonResponse
    {
        $expense = $this->expenses->create($vehicle, $request->validated());

        return (new ExpenseResource($expense))->response()->setStatusCode(201);
    }

    /** 409 si el gasto está vinculado a una intervención. */
    public function update(ExpenseRequest $request, Expense $expense): ExpenseResource
    {
        return new ExpenseResource($this->expenses->update($expense, $request->validated()));
    }

    /** 409 si el gasto está vinculado a una intervención. */
    public function destroy(Expense $expense): Response
    {
        $this->expenses->delete($expense);

        return $this->noContent();
    }
}
