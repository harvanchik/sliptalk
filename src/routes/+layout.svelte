<script>
	import '../app.css';
	import { settings } from '../stores/settings';
	import { onMount } from 'svelte';

	// Browser check to avoid SSR issues
	let browser = false;

	// Apply theme class to HTML element following Tailwind's approach
	$: if (browser) {
		if ($settings.theme === 'dark') {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}

	onMount(() => {
		browser = true;
	});
</script>

<slot />
