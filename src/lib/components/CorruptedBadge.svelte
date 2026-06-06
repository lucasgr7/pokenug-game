<script lang="ts">
	let { size = 20 }: { size?: number } = $props();
</script>

<span
	class="corrupted-badge"
	style="font-size: {size}px; width: {size * 1.4}px; height: {size * 1.4}px;"
	aria-label="Corrompido"
>
	☠
</span>

<style>
	.corrupted-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: #3a0008;
		color: #ff1a1a;
		font-weight: 900;
		text-shadow: 0 0 6px rgba(255, 26, 26, 0.7);
		animation: corruptPulse 1.4s ease-in-out infinite;
		line-height: 1;
	}
	@keyframes corruptPulse {
		0%, 100% { box-shadow: 0 0 4px rgba(255, 26, 26, 0.3); }
		50% { box-shadow: 0 0 12px rgba(255, 26, 26, 0.7); }
	}
</style>
