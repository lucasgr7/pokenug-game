<script lang="ts">
	interface Props {
		trigger: number;
		message?: string;
	}

	let { trigger, message = 'LUCRO!' }: Props = $props();

	let visible = $state(false);
	let key = $state(0);

	$effect(() => {
		if (trigger > 0) {
			key = trigger;
			visible = true;
			setTimeout(() => {
				visible = false;
			}, 1200);
		}
	});
</script>

{#if visible}
	{#key key}
		<div class="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
			<div class="great-deal-burst">
				<span class="great-deal-text">{message}</span>
			</div>
		</div>
	{/key}
{/if}

<style>
	.great-deal-burst {
		animation: burst 1.2s ease-out forwards;
		background: radial-gradient(circle, #ffc24a88 0%, transparent 70%);
		width: 100vw;
		height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.great-deal-text {
		font-size: 2.5rem;
		font-weight: 900;
		color: #ffc24a;
		text-shadow: 0 0 20px #ffc24a88, 0 2px 4px rgba(0, 0, 0, 0.5);
		animation: textPop 1.2s ease-out forwards;
	}

	@keyframes burst {
		0% {
			opacity: 0;
			transform: scale(0.5);
		}
		20% {
			opacity: 1;
			transform: scale(1);
		}
		80% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: scale(1.1);
		}
	}

	@keyframes textPop {
		0% {
			transform: scale(0.3);
			opacity: 0;
		}
		30% {
			transform: scale(1.2);
			opacity: 1;
		}
		50% {
			transform: scale(1);
		}
		80% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translateY(-20px);
		}
	}
</style>
