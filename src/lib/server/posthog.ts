import { PostHog } from 'posthog-node';
import { env } from '$env/dynamic/public';

let posthogClient: PostHog | null = null;

export function getPostHogClient() {
	const projectToken = env.PUBLIC_POSTHOG_PROJECT_TOKEN;
	if (!projectToken) return null;

	if (!posthogClient) {
		posthogClient = new PostHog(projectToken, {
			host: env.PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
			flushAt: 1,
			flushInterval: 0
		});
	}
	return posthogClient;
}

export async function shutdownPostHog() {
	if (posthogClient) {
		await posthogClient.shutdown();
	}
}
