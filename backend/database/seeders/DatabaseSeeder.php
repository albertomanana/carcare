<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Los datos de demostración (ficticios) solo se cargan fuera de producción.
     * En producción no se siembra nada: las cuentas se crean al registrarse.
     */
    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->warn('Producción: no se cargan datos de demostración.');

            return;
        }

        $this->call(DemoSeeder::class);
    }
}
