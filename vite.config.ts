import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		// Vite 8 introduced strict origin/host validation for HMR WebSocket
		// connections. This blocks the dev WebSocket when accessed through
		// VS Code's Simple Browser, browser extensions, or any proxy.
		// Setting allowedHosts to true disables the check for local dev.
		allowedHosts: true
	}
});
