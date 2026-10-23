<?php

namespace App\Models;

use App\Casts\DateOnly;
use App\Enums\MileageSource;
use Database\Factories\MileageLogFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MileageLog extends Model
{
    /** @use HasFactory<MileageLogFactory> */
    use HasFactory;

    protected $fillable = ['vehicle_id', 'recorded_at', 'mileage', 'source', 'source_id', 'note'];

    protected function casts(): array
    {
        return [
            'recorded_at' => DateOnly::class,
            'mileage' => 'integer',
            'source' => MileageSource::class,
            'source_id' => 'integer',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    /** Orden canónico: más reciente por fecha y, a igual fecha, mayor km. */
    public function scopeLatestFirst(Builder $query): Builder
    {
        return $query->orderByDesc('recorded_at')->orderByDesc('mileage')->orderByDesc('id');
    }

    public function scopeOldestFirst(Builder $query): Builder
    {
        return $query->orderBy('recorded_at')->orderBy('mileage')->orderBy('id');
    }
}
