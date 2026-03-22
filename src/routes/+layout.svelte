<script lang="ts">
	import favicon from "$lib/assets/favicon.svg";
	import { onMount } from "svelte";
	import "../app.css";
	import { demoStore } from "$lib/stores/demoStore";
	import GempaBumiAlert from "$lib/components/GempaBumiAlert.svelte";
	import TsunamiAlert from "$lib/components/TsunamiAlert.svelte";

	let { children } = $props();

	onMount(() => {
		// Auto-clear alerts after 15 seconds to ensure clean slate on new tabs/refresh
		const timeout = setTimeout(() => {
			demoStore.clearAlerts();
		}, 15000);
		return () => clearTimeout(timeout);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>EWS Concept UI</title>
	<meta
		name="description"
		content="Concept UI based Nerv App & Neon Genesis Evangelion"
	/>
</svelte:head>

<div class="backgroundline absolute inset-0 pointer-events-none z-10"></div>
<div class="no-snapshot scanline fixed inset-0 pointer-events-none z-10"></div>
{@render children()}

{#if $demoStore.gempaAlert}
	<GempaBumiAlert
		magnitudo={$demoStore.gempaAlert.mag}
		kedalaman={$demoStore.gempaAlert.depth}
		show={true}
		closeInSecond={10}
	/>
{/if}

{#if $demoStore.tsunamiAlert}
	<TsunamiAlert infoTsunami={$demoStore.tsunamiAlert} closeInSecond={10} />
{/if}
