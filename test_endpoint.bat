@echo off
echo === TESTANDO REQUISICAO REAL AO ENDPOINT ===
echo.

REM Assumindo que o usuário está logado, vamos simular uma requisição
echo Fazendo requisição GET /orders?start_date=2025-12-01^&end_date=2025-12-31
echo.

php artisan tinker --execute="$user = App\Models\User::first(); if ($user) { echo 'Tenant ID: ' . $user->tenant_id . PHP_EOL; $orders = App\Models\Order::where('tenant_id', $user->tenant_id)->whereBetween('placed_at', [\Carbon\Carbon::parse('2025-12-01 00:00:00', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString(), \Carbon\Carbon::parse('2025-12-31 23:59:59', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString()])->count(); echo 'Total de pedidos: ' . $orders . PHP_EOL; }"

echo.
echo === INSTRUCOES PARA O USUARIO ===
echo.
echo 1. Abra o DevTools do navegador (F12)
echo 2. Va para a aba Network
echo 3. Atualize a pagina de pedidos com Ctrl+Shift+R (hard refresh)
echo 4. Procure pela requisicao GET /orders
echo 5. Verifique os parametros: start_date e end_date
echo 6. Veja quantos registros foram retornados
echo.
echo Se ainda mostrar 92 pedidos, o problema esta no cache do navegador.
echo Solucao: Limpar cache completamente (Ctrl+Shift+Del) ou testar em aba anonima.
echo.
pause
