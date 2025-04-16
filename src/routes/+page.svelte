<script lang="ts">
	import { onMount } from 'svelte';

	// Type definition for phrases
	interface Phrase {
		text: string;
		points: number;
		used?: boolean;
	}

	// Game state
	let phrases: Phrase[] = [];
	let totalScore = 0;
	let isLoading = false;

	// Generate phrases using our server API endpoint
	async function generateAIPhrases(): Promise<Phrase[]> {
		try {
			isLoading = true;

			const response = await fetch('/api/generate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				throw new Error(`API error: ${response.status}`);
			}

			const phrases: Phrase[] = await response.json();
			return phrases;
		} catch (error) {
			console.error('Error generating phrases:', error);
			return fallbackPhrases();
		} finally {
			isLoading = false;
		}
	}

	// Fallback phrases if API call fails
	function fallbackPhrases(): Phrase[] {
		return [
			{ text: 'I always forget about my elbows', points: 1 },
			{ text: 'You ever think pigeons are spies?', points: 2 },
			{ text: 'They banned me from the aquarium for tickling the stingrays', points: 3 }
		];
	}

	// Initialize phrases with "used" status
	async function initPhrases() {
		isLoading = true;
		const generatedPhrases = await generateAIPhrases();
		phrases = generatedPhrases.map((phrase) => ({
			...phrase,
			used: false
		}));
		calculateScore();
		saveToLocalStorage();
		isLoading = false;
	}

	// Save game state to localStorage
	function saveToLocalStorage() {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('slipTalk', JSON.stringify({ phrases, totalScore }));
		}
	}

	// Load game state from localStorage
	function loadFromLocalStorage() {
		if (typeof localStorage !== 'undefined') {
			const saved = localStorage.getItem('slipTalk');
			if (saved) {
				const data = JSON.parse(saved);
				phrases = data.phrases;
				totalScore = data.totalScore;
				return true;
			}
		}
		return false;
	}

	// Update total score
	function calculateScore() {
		totalScore = phrases.reduce((sum, phrase) => sum + (phrase.used ? phrase.points : 0), 0);
	}

	// Toggle phrase used status
	function togglePhraseUsed(index: number) {
		phrases[index].used = !phrases[index].used;
		calculateScore();
		saveToLocalStorage();
	}

	// Reset game
	async function resetGame() {
		await initPhrases();
	}

	// Initialize game on component mount
	onMount(() => {
		if (!loadFromLocalStorage()) {
			initPhrases();
		}
	});
</script>

<svelte:head>
	<title>SlipTalk</title>
	<meta name="description" content="A sneaky phrase game to play with friends" />
</svelte:head>

<section class="min-h-screen bg-white px-4 py-8">
	<div class="max-w-md mx-auto">
		<!-- Header -->
		<div class="mb-8 text-center">
			<!-- Logo -->
			<img src="/src/lib/images/logo.jpg" alt="SlipTalk Logo" class="mx-auto mb-4 w-32" />
			<p class="text-gray-500">Sneak these phrases into conversation</p>

			<!-- Score Display -->
			<div class="mt-4 text-2xl font-bold">
				Score: <span class="text-sky-600">{totalScore}</span>
			</div>
		</div>

		<!-- Phrases Section (both loading and loaded states) -->
		<div class="space-y-4 mb-8">
			{#if isLoading}
				<!-- Loading State Cards -->
				{#each [1, 2, 3] as points}
					<div class="border border-gray-200 shadow-md p-4">
						<div class="flex justify-between items-start mb-2">
							<span class="inline-block px-2 py-1 bg-sky-100 text-sky-800 text-xs font-bold">
								{points}
								{points === 1 ? 'POINT' : 'POINTS'}
							</span>

							<button
								disabled
								class="text-sm px-3 py-1 border border-gray-300 shadow-sm opacity-60"
							>
								Mark as Used
							</button>
						</div>

						<div class="animate-pulse h-8 bg-gray-200 rounded w-full"></div>
					</div>
				{/each}
			{:else}
				<!-- Phrase Cards -->
				{#each phrases as phrase, i}
					<div
						class="border border-gray-200 shadow-md p-4 transition-all duration-200"
						class:opacity-50={phrase.used}
						class:bg-gray-50={phrase.used}
					>
						<div class="flex justify-between items-start mb-2">
							<span class="inline-block px-2 py-1 bg-sky-100 text-sky-800 text-xs font-bold">
								{phrase.points}
								{phrase.points === 1 ? 'POINT' : 'POINTS'}
							</span>

							<button
								on:click={() => togglePhraseUsed(i)}
								class="text-sm px-3 py-1 border border-gray-300 shadow-sm hover:bg-gray-50 transition-colors"
								class:bg-green-100={phrase.used}
								class:border-green-300={phrase.used}
								class:text-green-700={phrase.used}
							>
								{phrase.used ? 'Used ✓' : 'Mark as Used'}
							</button>
						</div>

						<p class="text-xl font-medium" class:line-through={phrase.used}>
							"{phrase.text}"
						</p>
					</div>
				{/each}
			{/if}
		</div>

		<!-- Reset Button -->
		<div class="text-center">
			<button
				on:click={resetGame}
				disabled={isLoading}
				class="px-6 py-3 bg-black text-white font-bold shadow-lg hover:shadow-xl transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{isLoading ? 'Generating...' : 'Get New Phrases'}
			</button>
		</div>
	</div>
</section>
