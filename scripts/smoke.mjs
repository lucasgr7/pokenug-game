import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:5179';
const browser = await chromium.launch({
	executablePath:
		process.env.HOME +
		'/Library/Caches/ms-playwright/chromium-1064/chrome-mac/Chromium.app/Contents/MacOS/Chromium'
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

const errors = [];
page.on('console', (m) => {
	if (m.type() === 'error') errors.push(`[console.error] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const shot = async (n) => {
	await page.screenshot({ path: `/tmp/pokengu-${n}.png` });
	console.log('shot:', n);
};
const handIds = () =>
	page.evaluate(() => {
		// @ts-ignore
		return (window.__battle?.state?.hand ?? []).map((c) => c.id);
	});

try {
	await page.goto(BASE, { waitUntil: 'networkidle' });
	await page.waitForTimeout(800);

	if (page.url().includes('onboarding')) {
		await page.fill('#trainer-name', 'Cavernoso');
		await page.locator('main button').filter({ hasText: 'Bulbasaur' }).first().click();
		await page.getByText('Começar aventura').click();
		await page.waitForTimeout(1500);
	}
	console.log('home url:', page.url());

	// --- DECK page: try adding cards ---
	await page.goto(BASE + '/deck', { waitUntil: 'networkidle' });
	await page.waitForTimeout(800);
	await shot('deck');
	const deckInfo = await page.evaluate(() => {
		const groups = [...document.querySelectorAll('main h2')].map((h) => h.textContent);
		return { headings: groups };
	});
	console.log('deck headings:', JSON.stringify(deckInfo));

	// --- BATTLE 1 ---
	await page.goto(BASE + '/', { waitUntil: 'networkidle' });
	await page.waitForTimeout(500);
	await page.locator('main button').first().click();
	await page.waitForTimeout(2500);
	console.log('battle1 url:', page.url());
	const hand1 = await handIds();
	console.log('hand before endturn:', hand1.length, hand1.slice(0, 2));

	// play first card (click a hand card)
	const cards = page.locator('section').last().locator('button').filter({ hasText: /Básic|Pokébola|Defesa|Ataque/ });
	// End turn
	await page.getByText('Fim de turno').click();
	await page.waitForTimeout(1200);
	const hand2 = await handIds();
	console.log('hand after endturn:', hand2.length, hand2.slice(0, 2));
	console.log('overlap kept:', hand1.filter((x) => hand2.includes(x)).length);
	await shot('battle1-afterturn');

	// Leave and start BATTLE 2
	await page.goto(BASE + '/', { waitUntil: 'networkidle' });
	await page.waitForTimeout(600);
	await page.locator('main button').first().click();
	await page.waitForTimeout(2500);
	console.log('battle2 url:', page.url());
	await shot('battle2');
	const hasArena = await page.locator('section').first().isVisible().catch(() => false);
	console.log('battle2 arena visible:', hasArena);
} catch (e) {
	console.log('SCRIPT ERROR:', e.message);
}

console.log('--- errors ---');
console.log(errors.length ? errors.join('\n') : '(none)');
await browser.close();
