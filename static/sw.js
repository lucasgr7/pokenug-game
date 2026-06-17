const AUDIO_CACHE = 'pokengu-audio-v1';
const MP3_FILES = [
	'/mp3/menu-1.mp3',
	'/mp3/menu-2.mp3',
	'/mp3/battle-1.mp3',
	'/mp3/battle-2.mp3',
	'/mp3/battle-3.mp3',
	'/mp3/boss.mp3',
	'/mp3/boss-2.mp3'
];

self.addEventListener('install', (e) => {
	e.waitUntil(
		caches.open(AUDIO_CACHE)
			.then((cache) => cache.addAll(MP3_FILES))
			.catch(() => console.warn('[sw] Audio precache failed — will cache on first play'))
	);
	self.skipWaiting();
});

self.addEventListener('activate', (e) => {
	e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
	// Não intercepta a API do Ollama — deixa ir direto à rede (proxy do nginx).
	if (e.request.url.includes('/ollama/')) return;

	if (e.request.url.includes('/mp3/')) {
		e.respondWith(
			caches.match(e.request).then((cached) => {
				if (cached) return cached;
				return fetch(e.request).then((res) => {
					if (res.ok) {
						const clone = res.clone();
						caches.open(AUDIO_CACHE).then((cache) => cache.put(e.request, clone));
					}
					return res;
				});
			})
		);
		return;
	}
	e.respondWith(fetch(e.request));
});
