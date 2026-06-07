import { register, init, locale, _, waitLocale, getLocaleFromNavigator } from 'svelte-i18n';
import { get } from 'svelte/store';

export const LOCALES = ['pt-BR', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
const STORAGE_KEY = 'pokengu-locale';

register('pt-BR', () => import('./locales/pt-BR.json'));
register('en', () => import('./locales/en.json'));

const stored = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY);
init({
	fallbackLocale: 'pt-BR',
	initialLocale: (stored || getLocaleFromNavigator() || 'pt-BR') as Locale
});

export const t = (key: string, values?: Record<string, string | number | boolean>) => get(_)(key, values ? { values } : undefined);

export function setLocale(next: Locale) {
	localStorage.setItem(STORAGE_KEY, next);
	locale.set(next);
}

export { _, locale, waitLocale };
