import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type ViteUserConfig } from 'vitest/config';

// O plugin do SvelteKit resolve $lib/$app e compila runes em .svelte.ts.
// O cast existe porque o vitest 3 embute tipos do vite 7 e o projeto usa
// vite 8 — conflito só de tipos, em runtime são compatíveis.
const plugins = [sveltekit()] as ViteUserConfig['plugins'];

export default defineConfig({
	plugins,
	test: {
		include: ['src/**/*.spec.ts'],
		environment: 'node',
		setupFiles: ['src/lib/testing/setup.ts']
	}
});
