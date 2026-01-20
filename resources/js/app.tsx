import '../css/app.css';

import { createInertiaApp, router } from '@inertiajs/react';
import Echo from 'laravel-echo';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import Pusher from 'pusher-js';
import { createRoot } from 'react-dom/client';
import { toast } from 'sonner';
import { initializeTheme } from './hooks/use-appearance';

// Configurar Laravel Echo para WebSockets
declare global {
    interface Window {
        Pusher: typeof Pusher;
        Echo: Echo;
    }
}

window.Pusher = Pusher;

// Detectar ambiente e configurar WebSocket adequadamente
const isSecure = window.location.protocol === 'https:';

window.Echo = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: window.location.hostname,
    wsPort: isSecure ? 443 : 8080,
    wssPort: 443,
    forceTLS: isSecure,
    encrypted: isSecure,
    enabledTransports: isSecure ? ['wss'] : ['ws'],
    disableStats: true,
});

// Log de debug para verificar configuração
console.log('[WebSocket] Echo configurado:', {
    key: import.meta.env.VITE_REVERB_APP_KEY,
    host: window.location.hostname,
    port: isSecure ? 443 : 8080,
    secure: isSecure,
});

// Forçar conexão do Pusher
if (window.Echo.connector?.pusher) {
    window.Echo.connector.pusher.connect();
    console.log('[WebSocket] Conexão Pusher iniciada');
}

const appName = import.meta.env.VITE_APP_NAME || 'Lucro Fácil';

// Tratamento global de erros 419 (CSRF Token Mismatch)
router.on('error', (event) => {
    const response = event.detail.page?.props?.errors;
    const status = event.detail.page?.props?.status;

    // Se for erro 419, tentar recarregar a página para renovar o token
    if (
        status === 419 ||
        (response &&
            Object.keys(response).length > 0 &&
            window.location.pathname.includes('/login') === false)
    ) {
        toast.error('Sua sessão expirou. Recarregando a página...', {
            duration: 3000,
        });

        // Aguardar 1 segundo e recarregar
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }
});

// Interceptar erros de resposta HTTP
document.addEventListener('inertia:error', (event: any) => {
    const status = event.detail?.response?.status;

    if (status === 419) {
        toast.error('Token de segurança expirado. Recarregando...', {
            duration: 3000,
        });

        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }
});

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) =>
        resolvePageComponent(
            `./pages/${name}.tsx`,
            import.meta.glob('./pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(<App {...props} />);
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
