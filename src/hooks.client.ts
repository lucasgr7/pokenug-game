import posthog from 'posthog-js';
import { env } from '$env/dynamic/public';
import type { HandleClientError } from '@sveltejs/kit';

export async function init() {
	const projectToken = env.PUBLIC_POSTHOG_PROJECT_TOKEN;
	if (!projectToken) return;

	posthog.init(projectToken, {
		api_host: '/ingest',
		ui_host: 'https://us.posthog.com',
		defaults: '2026-01-30',
		capture_exceptions: true
	});
}

export const handleError: HandleClientError = async ({ error, status, message }) => {
	posthog.captureException(error);
	return { message, status };
};
