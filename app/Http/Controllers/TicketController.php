<?php

namespace App\Http\Controllers;

use App\Models\Ticket;
use Illuminate\Http\Request;
use Inertia\Inertia;

class TicketController extends Controller
{
    /**
     * Lista todos os tickets do tenant
     */
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        $tickets = Ticket::where('tenant_id', $tenantId)
            ->with(['user', 'latestMessage'])
            ->orderBy('created_at', 'desc')
            ->paginate(15);

        return Inertia::render('tickets/index', [
            'tickets' => $tickets,
        ]);
    }

    /**
     * Exibe formulário de criação
     */
    public function create()
    {
        return Inertia::render('tickets/create');
    }

    /**
     * Cria um novo ticket
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'subject' => 'required|string|max:255',
            'message' => 'required|string',
            'priority' => 'required|in:low,medium,high',
        ]);

        $ticket = Ticket::create([
            'tenant_id' => $request->user()->tenant_id,
            'user_id' => $request->user()->id,
            'subject' => $validated['subject'],
            'priority' => $validated['priority'],
            'status' => 'open',
        ]);

        // Criar mensagem inicial
        $ticket->messages()->create([
            'user_id' => $request->user()->id,
            'message' => $validated['message'],
        ]);

        return redirect()
            ->route('tickets.show', $ticket)
            ->with('success', 'Chamado criado com sucesso!');
    }

    /**
     * Exibe detalhes do ticket
     */
    public function show(Request $request, Ticket $ticket)
    {
        // Verificar se o ticket pertence ao tenant do usuário
        if ($ticket->tenant_id !== $request->user()->tenant_id) {
            abort(403, 'Acesso negado.');
        }

        $ticket->load(['user', 'messages.user']);

        return Inertia::render('tickets/show', [
            'ticket' => $ticket,
        ]);
    }

    /**
     * Adiciona uma mensagem ao ticket
     */
    public function addMessage(Request $request, Ticket $ticket)
    {
        // Verificar se o ticket pertence ao tenant do usuário
        if ($ticket->tenant_id !== $request->user()->tenant_id) {
            abort(403, 'Acesso negado.');
        }

        $validated = $request->validate([
            'message' => 'required|string',
        ]);

        $ticket->messages()->create([
            'user_id' => $request->user()->id,
            'message' => $validated['message'],
        ]);

        // Reabrir ticket se estava fechado
        if ($ticket->status === 'closed') {
            $ticket->update(['status' => 'open']);
        }

        return back()->with('success', 'Mensagem enviada com sucesso!');
    }

    /**
     * Fecha o ticket
     */
    public function close(Request $request, Ticket $ticket)
    {
        // Verificar se o ticket pertence ao tenant do usuário
        if ($ticket->tenant_id !== $request->user()->tenant_id) {
            abort(403, 'Acesso negado.');
        }

        $ticket->update(['status' => 'closed']);

        return back()->with('success', 'Chamado fechado com sucesso!');
    }
}
