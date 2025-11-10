<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class TestIfoodConnection extends Command
{
    protected $signature = 'ifood:test-connection';
    protected $description = 'Testa a conexão e credenciais do iFood';

    public function handle(): int
    {
        $this->info('🔍 Testando conexão com iFood...');
        $this->newLine();

        // 1. Verificar configurações
        $this->info('1️⃣ Verificando configurações:');
        $clientId = config('services.ifood.client_id');
        $clientSecret = config('services.ifood.client_secret');
        $baseUrl = config('services.ifood.base_url');

        $this->line("   Base URL: {$baseUrl}");
        $this->line("   Client ID: " . ($clientId ? substr($clientId, 0, 20) . '...' : '❌ NÃO CONFIGURADO'));
        $this->line("   Client Secret: " . ($clientSecret ? substr($clientSecret, 0, 20) . '...' : '❌ NÃO CONFIGURADO'));
        $this->newLine();

        if (!$clientId || !$clientSecret) {
            $this->error('❌ Credenciais não configuradas!');
            $this->line('Verifique o arquivo .env');
            return self::FAILURE;
        }

        // 2. Testar userCode endpoint
        $this->info('2️⃣ Testando endpoint userCode:');
        try {
            $response = Http::asForm()->post("{$baseUrl}authentication/v1.0/oauth/userCode", [
                'clientId' => $clientId
            ]);

            $this->line("   Status: {$response->status()}");

            if ($response->successful()) {
                $this->info('   ✅ UserCode gerado com sucesso!');
                $data = $response->json();
                $this->line("   Verification URL: " . ($data['verificationUrlComplete'] ?? 'N/A'));
            } else {
                $this->error('   ❌ Erro ao gerar userCode');
                $this->line('   Response: ' . $response->body());
            }
        } catch (\Throwable $e) {
            $this->error('   ❌ Exceção: ' . $e->getMessage());
        }

        $this->newLine();
        $this->info('✅ Teste concluído!');

        return self::SUCCESS;
    }
}
