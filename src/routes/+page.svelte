<script lang="ts">
	import { onMount } from 'svelte';
	import { settings } from '../stores/settings';
	import { fade, fly } from 'svelte/transition';

	// Type definitions
	interface Phrase {
		text: string;
		points: number;
		used?: boolean;
	}

	interface PhraseBatch {
		phrases: Phrase[];
		timestamp: string; // ISO string format
		id: string; // Unique identifier for each batch
	}

	interface GameState {
		currentPhrases: Phrase[];
		totalScore: number;
		history: PhraseBatch[];
	}

	// Game state
	let phrases: Phrase[] = [];
	let totalScore = 0;
	let isLoading = false;
	let phraseHistory: PhraseBatch[] = [];
	let showHistory = false;

	// Settings modal state
	let showSettingsModal = false;
	let isConfirmingReset = false;

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

		// Create a new batch with timestamp
		const newBatch: PhraseBatch = {
			phrases: JSON.parse(JSON.stringify(phrases)), // Deep copy to prevent reference issues
			timestamp: new Date().toISOString(),
			id: crypto.randomUUID()
		};

		// Add to history without clearing the history
		phraseHistory = [newBatch, ...phraseHistory];

		// Don't reset the score, just save the new state
		saveToLocalStorage();
		isLoading = false;
	}

	// Save game state to localStorage
	function saveToLocalStorage() {
		if (typeof localStorage !== 'undefined') {
			const gameState: GameState = {
				currentPhrases: phrases,
				totalScore: totalScore,
				history: phraseHistory
			};
			localStorage.setItem('slipTalk', JSON.stringify(gameState));
		}
	}

	// Load game state from localStorage
	function loadFromLocalStorage() {
		if (typeof localStorage !== 'undefined') {
			const saved = localStorage.getItem('slipTalk');
			if (saved) {
				try {
					const data = JSON.parse(saved) as GameState;

					// Handle both old and new storage formats
					if (data.currentPhrases) {
						// New format
						phrases = data.currentPhrases;
						totalScore = data.totalScore;
						phraseHistory = data.history || [];
					} else {
						// Old format
						phrases = (data as any).phrases || [];
						totalScore = (data as any).totalScore || 0;
						phraseHistory = [];

						// If we have phrases but no history, create an initial history entry
						if (phrases.length > 0) {
							phraseHistory = [
								{
									phrases: JSON.parse(JSON.stringify(phrases)),
									timestamp: new Date().toISOString(),
									id: crypto.randomUUID()
								}
							];
						}
					}
					return true;
				} catch (e) {
					console.error('Error parsing saved game state:', e);
					return false;
				}
			}
		}
		return false;
	}

	// Toggle showing phrase history
	function toggleHistory() {
		showHistory = !showHistory;
	}

	// Format date for display
	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		}).format(date);
	}

	// Update total score
	function calculateScore() {
		totalScore = phrases.reduce((sum, phrase) => sum + (phrase.used ? phrase.points : 0), 0);
	}

	// Toggle phrase used status
	function togglePhraseUsed(index: number) {
		// Update the current phrase
		phrases[index].used = !phrases[index].used;

		// Find this phrase in history (if it exists in history)
		const currentPhrase = phrases[index];

		// Find the batch that contains this phrase
		const batch = phraseHistory.find((batch) =>
			batch.phrases.some((p) => p.text === currentPhrase.text && p.points === currentPhrase.points)
		);

		if (batch) {
			// Find the phrase in the batch and update its used status
			const phraseInBatch = batch.phrases.find(
				(p) => p.text === currentPhrase.text && p.points === currentPhrase.points
			);

			if (phraseInBatch) {
				phraseInBatch.used = currentPhrase.used;
			}
		}

		calculateScore();
		saveToLocalStorage();
	}

	// Reset game
	async function resetGame() {
		await initPhrases();
	}

	// Reset score without generating new phrases
	function resetScore() {
		if (isConfirmingReset) {
			phrases = phrases.map((phrase) => ({
				...phrase,
				used: false
			}));
			calculateScore();
			saveToLocalStorage();
			isConfirmingReset = false;
			showSettingsModal = false; // Close the modal after successful reset
		} else {
			isConfirmingReset = true;
			setTimeout(() => {
				isConfirmingReset = false;
			}, 3000);
		}
	}

	// Toggle settings modal
	function toggleSettings() {
		showSettingsModal = !showSettingsModal;
		if (!showSettingsModal) {
			isConfirmingReset = false;
		}
	}

	// Close modal when clicking outside
	function closeModalOnOutsideClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (target.classList.contains('modal-backdrop')) {
			showSettingsModal = false;
			isConfirmingReset = false;
		}
	}

	// Initialize game on component mount
	onMount(() => {
		if (!loadFromLocalStorage()) {
			initPhrases();
		}
	});

	// Theme reactive values
	$: theme = $settings.theme;
	$: isDarkMode = theme === 'dark';
</script>

<svelte:head>
	<title>SlipTalk</title>
	<meta name="description" content="A sneaky phrase game to play with friends" />
</svelte:head>

<section class="min-h-screen bg-white dark:bg-gray-900 px-4 py-8 transition-colors duration-200">
	<div class="max-w-md mx-auto">
		<!-- Header -->
		<div class="mb-8 text-center">
			<h1
				class="text-5xl font-bold bg-gradient-to-r from-blue-600 via-fuchsia-600 to-violet-600 inline-block text-transparent bg-clip-text mb-2"
			>
				SlipTalk
			</h1>
			<p class="text-gray-500 dark:text-gray-400">Sneak these phrases into conversation</p>

			<!-- Score Display -->
			<div class="mt-4 text-2xl font-bold text-gray-900 dark:text-white">
				Score: <span class="text-sky-600 dark:text-sky-400">{totalScore}</span>
			</div>
		</div>

		<!-- Phrases Section (both loading and loaded states) -->
		<div class="space-y-4 mb-8">
			{#if isLoading}
				<!-- Loading State Cards -->
				{#each [1, 2, 3] as points}
					<div
						class="border border-gray-200 dark:border-gray-700 shadow-md p-4 dark:bg-gray-800 transition-colors duration-200"
					>
						<div class="flex justify-between items-start mb-2">
							<span
								class="inline-block px-2 py-1 bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100 text-xs font-bold transition-colors duration-200"
							>
								{points}
								{points === 1 ? 'POINT' : 'POINTS'}
							</span>

							<button
								disabled
								class="text-sm px-3 py-1 border border-gray-300 dark:border-gray-600 shadow-sm opacity-60 transition-colors duration-200"
							>
								Mark as Used
							</button>
						</div>

						<div
							class="animate-pulse h-8 bg-gray-200 dark:bg-gray-700 rounded w-full transition-colors duration-200"
						></div>
					</div>
				{/each}
			{:else}
				<!-- Phrase Cards -->
				{#each phrases as phrase, i}
					<div
						class="border border-gray-200 dark:border-gray-700 shadow-md p-4 transition-all duration-200 dark:bg-gray-800"
						class:opacity-50={phrase.used}
						class:bg-gray-50={phrase.used && !isDarkMode}
						class:bg-gray-700={phrase.used && isDarkMode}
					>
						<div class="flex justify-between items-start mb-2">
							<span
								class="inline-block px-2 py-1 bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100 text-xs font-bold transition-colors duration-200"
							>
								{phrase.points}
								{phrase.points === 1 ? 'POINT' : 'POINTS'}
							</span>

							<button
								on:click={() => togglePhraseUsed(i)}
								class="text-sm px-3 py-1 border border-gray-300 dark:border-gray-600 shadow-sm hover:bg-gray-50 hover:dark:bg-gray-700 transition-colors dark:text-gray-200"
								class:bg-green-100={phrase.used && !isDarkMode}
								class:bg-green-800={phrase.used && isDarkMode}
								class:border-green-300={phrase.used && !isDarkMode}
								class:border-green-700={phrase.used && isDarkMode}
								class:text-green-700={phrase.used && !isDarkMode}
								class:text-green-300={phrase.used && isDarkMode}
							>
								{phrase.used ? 'Used ✓' : 'Mark as Used'}
							</button>
						</div>

						<p
							class="text-xl font-medium dark:text-white transition-colors duration-200"
							class:line-through={phrase.used}
						>
							"{phrase.text}"
						</p>
					</div>
				{/each}
			{/if}
		</div>

		<!-- Buttons -->
		<div class="text-center space-y-3">
			<button
				on:click={resetGame}
				disabled={isLoading}
				class="px-6 py-3 bg-black text-white dark:bg-gray-800 dark:border dark:border-gray-700 font-bold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed w-full transition-all duration-200"
			>
				{isLoading ? 'Generating...' : 'Get New Phrases'}
			</button>

			<div class="flex space-x-2">
				<button
					on:click={toggleHistory}
					class="flex-1 px-6 py-2 border border-gray-300 dark:border-gray-600 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 hover:dark:bg-gray-800 transition-colors flex items-center justify-center"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4 mr-2"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"
						/>
					</svg>
					{showHistory ? 'Hide History' : 'History'}
				</button>

				<button
					on:click={toggleSettings}
					class="px-4 py-2 border border-gray-300 dark:border-gray-600 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 hover:dark:bg-gray-800 transition-colors flex items-center justify-center"
					aria-label="Settings"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>
			</div>
		</div>

		<!-- Phrase History Section -->
		{#if showHistory}
			<div
				class="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6 transition-colors duration-200"
			>
				<h2 class="text-xl font-bold mb-4 dark:text-white">Phrase History</h2>

				{#if phraseHistory.length <= 1}
					<p class="text-gray-500 dark:text-gray-400 text-center py-4">
						No previous phrases found.
					</p>
				{:else}
					<div class="space-y-6">
						{#each phraseHistory.slice(1) as batch}
							<div
								class="bg-gray-50 dark:bg-gray-800 p-3 rounded-sm border border-gray-100 dark:border-gray-700 transition-colors duration-200"
							>
								<div class="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">
									{formatDate(batch.timestamp)}
								</div>
								<div class="space-y-2">
									{#each batch.phrases as phrase}
										<div class="flex items-start">
											<span
												class="inline-block px-1 py-0.5 text-xs font-bold mr-2 mt-0.5 transition-colors duration-200"
												class:opacity-60={!phrase.used}
												class:bg-lime-200={phrase.used}
												class:text-lime-800={phrase.used}
												class:bg-sky-100={!phrase.used}
												class:text-sky-800={!phrase.used}
												class:dark:bg-sky-900={!phrase.used}
												class:dark:text-sky-100={!phrase.used}
												class:dark:bg-lime-900={phrase.used}
												class:dark:text-lime-100={phrase.used}
											>
												{phrase.points}
											</span>
											<span class="text-sm dark:text-gray-300" class:opacity-60={!phrase.used}>
												"{phrase.text}"
											</span>
										</div>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Settings Modal -->
		{#if showSettingsModal}
			<div
				class="fixed inset-0 bg-black/70 backdrop-blur-[2px] flex items-center justify-center z-50 modal-backdrop"
				on:click={closeModalOnOutsideClick}
				on:keydown={(e) => e.key === 'Escape' && (showSettingsModal = false)}
				role="presentation"
				transition:fade={{ duration: 200 }}
			>
				<div
					class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-0 w-11/12 max-w-sm transition-colors duration-200"
					role="dialog"
					aria-modal="true"
					aria-labelledby="settings-modal-title"
					transition:fly={{ y: 10, duration: 300 }}
				>
					<div
						class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center"
					>
						<h3 id="settings-modal-title" class="text-xl font-bold dark:text-white">Settings</h3>
						<button
							on:click={() => (showSettingsModal = false)}
							class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
							aria-label="Close settings"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-5 w-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					</div>

					<div class="p-6 space-y-6">
						<!-- Theme Toggle -->
						<div class="flex justify-between items-center">
							<label for="theme-toggle" class="font-medium text-gray-700 dark:text-gray-300">
								Appearance
							</label>
							<div class="relative">
								<button
									id="theme-toggle"
									on:click={() => settings.toggleTheme()}
									class="relative w-16 h-8 bg-gray-100 dark:bg-gray-700 rounded-full p-1 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 overflow-hidden select-none"
									role="switch"
									aria-checked={isDarkMode}
									aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
									tabindex="0"
								>
									<!-- Sun icon (left side) -->
									<span
										class="absolute left-1 top-1 transition-opacity duration-300 pointer-events-none"
										class:opacity-100={!isDarkMode}
										class:opacity-0={isDarkMode}
									>
										<svg
											class="w-6 h-6 text-yellow-500"
											fill="currentColor"
											viewBox="0 0 20 20"
											xmlns="http://www.w3.org/2000/svg"
											aria-hidden="true"
										>
											<path
												d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
											/>
										</svg>
									</span>
									<!-- Moon icon (right side) -->
									<span
										class="absolute right-1 top-1 transition-opacity duration-300 pointer-events-none"
										class:opacity-0={!isDarkMode}
										class:opacity-100={isDarkMode}
									>
										<svg
											class="w-6 h-6 text-indigo-300"
											fill="currentColor"
											viewBox="0 0 20 20"
											xmlns="http://www.w3.org/2000/svg"
											aria-hidden="true"
										>
											<path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
										</svg>
									</span>
									<!-- Toggle knob -->
									<span
										class="absolute bg-white dark:bg-gray-900 w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 pointer-events-none"
										class:translate-x-0={!isDarkMode}
										class:translate-x-8={isDarkMode}
									></span>
								</button>
							</div>
						</div>

						<!-- Reset Score -->
						<div class="pt-3">
							<button
								on:click={resetScore}
								class="text-white w-full py-2.5 px-4 rounded-lg shadow-sm transition-all duration-200 font-medium text-center"
								class:bg-red-600={!isConfirmingReset}
								class:hover:bg-red-700={!isConfirmingReset}
								class:bg-red-700={isConfirmingReset}
								class:hover:bg-red-800={isConfirmingReset}
								class:ring-4={isConfirmingReset}
								class:ring-red-300={isConfirmingReset}
								class:dark:ring-red-900={isConfirmingReset}
							>
								{isConfirmingReset ? 'Tap again to confirm' : 'Reset Score'}
							</button>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
								Keeps current phrases but marks them as unused
							</p>
						</div>

						<!-- Version Info -->
						<div
							class="text-center text-xs text-gray-500 dark:text-gray-400 pt-3 mt-3 border-t border-gray-200 dark:border-gray-700"
						>
							SlipTalk v1.0
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</section>
