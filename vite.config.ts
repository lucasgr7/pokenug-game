import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Unit tests são configurados em vitest.config.ts (o vitest o prioriza).

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		// Vite 8 introduced strict origin/host validation for HMR WebSocket
		// connections. This blocks the dev WebSocket when accessed through
		// VS Code's Simple Browser, browser extensions, or any proxy.
		// Setting allowedHosts to true disables the check for local dev.
		allowedHosts: true,
		proxy: {
			'/ollama': {
				target: 'http://192.168.100.81:11434',
				rewrite: (p) => p.replace(/^\/ollama/, ''),
				changeOrigin: true
			}
		}
	}
});
