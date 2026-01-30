<?php

namespace App\Console\Commands;

use App\Jobs\RefreshTakeatTokensJob;
use Illuminate\Console\Command;

class RefreshTakeatTokensCommand extends Command
{
    protected $signature = 'takeat:refresh-tokens';

    protected $description = 'Executa manualmente a renovação de tokens Takeat expirando';

    public function handle(): int
    {
        $this->info('🚀 Disparando RefreshTakeatTokensJob...');

        dispatch(new RefreshTakeatTokensJob());

        $this->info('✅ Job disparado! Verifique os logs para detalhes.');

        return Command::SUCCESS;
    }
}
