<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>EWS Concept UI</title>
	<meta name="description" content="Concept UI based Nerv App & Neon Genesis Evangelion" />
</svelte:head>

{@render children()}
