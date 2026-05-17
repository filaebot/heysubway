<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
	<!-- Helvetica is the MTA typeface (Unimark 1970, updated by Vignelli). The
	     system stack approximates it everywhere; Helvetica Neue ships on
	     Apple platforms and Arial is the Windows/Android fallback. We lean
	     on the OS font rather than a webfont to match the authoritative,
	     printed-sign feel — a loaded webfont on a FOUT would feel wrong. -->
	<meta property="og:title" content="Hey Subway" />
	<meta property="og:description" content="Real-time NYC subway departures" />
	<meta property="og:image" content="/og-image.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Hey Subway" />
	<meta name="twitter:image" content="/og-image.png" />
</svelte:head>

{@render children()}

<style>
	:global(html),
	:global(body) {
		margin: 0;
		padding: 0;
		background: #000;
		color: #fff;
		/* MTA signage is set in Helvetica Medium. System stack first so we
		   get native rendering on Mac/iOS without a webfont flash. */
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-weight: 500;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
	}
	:global(*) {
		box-sizing: border-box;
	}
	:global(button, input) {
		font-family: inherit;
	}
</style>
