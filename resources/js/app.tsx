import '../css/app.css';

import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { toast } from 'sonner';
import { initializeTheme } from './hooks/use-appearance';

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
