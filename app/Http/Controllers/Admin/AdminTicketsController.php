<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Models\TicketMessage;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AdminTicketsController extends Controller
{
    /**
     * Lista todos os tickets (admin vê de todos os tenants)
     */
    public function index(Request $request)
    {
        $query = Ticket::with(['tenant', 'user', 'latestMessage.user']);

        // Filtros
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('priority')) {
            $query->where('priority', $request->priority);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('subject', 'like', "%{$search}%")
                    ->orWhereHas('tenant', function ($q) use ($search) {
                        $q->where('name', 'like', "%{$search}%");
                    });
            });
        }

        $tickets = $query->orderBy('created_at', 'desc')->paginate(20);

        return Inertia::render('admin/tickets/index', [
            'tickets' => $tickets,
            'filters' => [
                'status' => $request->status,
                'priority' => $request->priority,
                'search' => $request->search,
            ],
        ]);
    }

    /**
     * Exibe detalhes do ticket
     */
    public function show(Ticket $ticket)
    {
        $ticket->load(['tenant', 'user', 'messages.user']);

        return Inertia::render('admin/tickets/show', [
            'ticket' => $ticket,
        ]);
    }

    /**
     * Adiciona resposta do admin ao ticket
     */
    public function reply(Request $request, Ticket $ticket)
    {
        $validated = $request->validate([
            'message' => 'required|string',
        ]);

        $ticket->messages()->create([
            'user_id' => $request->user()->id,
            'message' => $validated['message'],
        ]);

        // Marcar como em progresso se estava aberto
        if ($ticket->status === 'open') {
            $ticket->update(['status' => 'in_progress']);
        }

        return back()->with('success', 'Resposta enviada com sucesso!');
    }

    /**
     * Atualiza status do ticket
     */
    public function updateStatus(Request $request, Ticket $ticket)
    {
        $validated = $request->validate([
            'status' => 'required|in:open,in_progress,closed',
        ]);

        $ticket->update(['status' => $validated['status']]);

        return back()->with('success', 'Status atualizado com sucesso!');
    }

    /**
     * Atualiza prioridade do ticket
     */
    public function updatePriority(Request $request, Ticket $ticket)
    {
        $validated = $request->validate([
            'priority' => 'required|in:low,medium,high',
        ]);

        $ticket->update(['priority' => $validated['priority']]);

        return back()->with('success', 'Prioridade atualizada com sucesso!');
    }
}
