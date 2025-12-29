import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Clock,
    Info,
    MoreVertical,
    PauseCircle,
    RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import { InterruptionsDialog } from './interruptions-dialog';
import { OpeningHoursDialog } from './opening-hours-dialog';
import { ReconnectDialog } from './reconnect-dialog';
import { StatusDialog } from './status-dialog';

type ActionsCellProps = {
    storeId: number;
    provider: string;
    tokenExpired?: boolean;
};

export function ActionsCell({
    storeId,
    provider,
    tokenExpired,
}: ActionsCellProps) {
    const [interruptionsOpen, setInterruptionsOpen] = useState(false);
    const [openingHoursOpen, setOpeningHoursOpen] = useState(false);
    const [statusOpen, setStatusOpen] = useState(false);
    const [reconnectOpen, setReconnectOpen] = useState(false);

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Abrir menu</span>
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Ações</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {(provider === 'takeat' ||
                        provider === 'ifood' ||
                        provider === '99food') && (
                        <>
                            <DropdownMenuItem
                                onClick={() => setReconnectOpen(true)}
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                {tokenExpired
                                    ? 'Reconectar (Token expirado)'
                                    : 'Reconectar'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                        </>
                    )}
                    <DropdownMenuItem onClick={() => setStatusOpen(true)}>
                        <Info className="mr-2 h-4 w-4" />
                        Ver Status
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => setInterruptionsOpen(true)}
                    >
                        <PauseCircle className="mr-2 h-4 w-4" />
                        Interrupções
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setOpeningHoursOpen(true)}>
                        <Clock className="mr-2 h-4 w-4" />
                        Horários
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <StatusDialog
                storeId={storeId}
                open={statusOpen}
                onOpenChange={setStatusOpen}
            />
            <ReconnectDialog
                storeId={storeId}
                provider={provider}
                open={reconnectOpen}
                onOpenChange={setReconnectOpen}
            />
            <InterruptionsDialog
                storeId={storeId}
                open={interruptionsOpen}
                onOpenChange={setInterruptionsOpen}
            />
            <OpeningHoursDialog
                storeId={storeId}
                open={openingHoursOpen}
                onOpenChange={setOpeningHoursOpen}
            />
        </>
    );
}
