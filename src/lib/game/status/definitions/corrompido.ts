import { defineStatus } from '../registry';
import { statusLabel, statusTitle } from '$lib/i18n/game';

defineStatus({
	id: 'nature_corrompido',
	scope: 'player',
	decay: 'permanent',
	hooks: {
		shouldExhaust: () => false,
		emblem: () => ({
			icon: '☠',
			label: statusLabel('nature_corrompido'),
			title: statusTitle('nature_corrompido'),
			color: '#ff1a1a',
			bg: '#3a0008'
		})
	}
});
