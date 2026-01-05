<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A tabela internal_products já tem os campos category e max_flavors
        // Esta migration apenas documenta que estão sendo usados para o sistema de fracionamento
        // Nenhuma alteração necessária
    }

    public function down(): void
    {
        // Nenhuma alteração necessária
    }
};
