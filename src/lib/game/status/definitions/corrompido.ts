import { defineStatus } from '../registry';

defineStatus({
	id: 'nature_corrompido',
	scope: 'player',
	decay: 'permanent',
	hooks: {
		shouldExhaust: () => false,
		emblem: () => ({
			icon: '☠',
			label: 'Corrompido',
			title: 'Cartas nunca exaurem',
			color: '#ff1a1a',
			bg: '#3a0008'
		})
	}
});
