import type { Config } from 'tailwindcss'
import forms from '@tailwindcss/forms'

const config: Config = {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            colors: {
                brand: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8',
                    800: '#1e40af',
                    900: '#1e3a8a',
                },
            },
            boxShadow: {
                glow: '0 0 40px -10px rgba(59, 130, 246, 0.6)',
            },
            maxWidth: {
                content: '1100px',
            },
        },
    },
    plugins: [forms],
}

export default config
