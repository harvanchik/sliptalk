<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly, slide } from 'svelte/transition';
	import { settings, type Phrase, type PhraseBatch, type Game } from '$lib/../stores/settings';

	// Game state
	let phrases: Phrase[] = [];
	let totalScore = 0;
	let isLoading = false;
	let showHistory = false;
	let settingsData: any;
	let errorMessage: string | null = null; // Add error message state

	// New game management state
	let showGameDialog = false;
	let newGameName = '';
	let isEditingGameName = false;
	let currentEditGameId = '';
	let showConfirmDeleteGame = false;
	let gameToDelete = '';
	let showConfirmDeleteBatch = false;
	let batchToDelete = { gameId: '', batchId: '' };

	// Settings modal state
	let showSettingsModal = false;
	let isConfirmingReset = false;

	// Generate phrases using our server API endpoint
	async function generateAIPhrases(): Promise<Phrase[]> {
		try {
			isLoading = true;
			errorMessage = null; // Reset error message on new request

			const response = await fetch('/api/generate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				if (response.status === 429) {
					const retryAfter = response.headers.get('Retry-After') || '60';
					errorMessage = `Rate limit exceeded. Please try again later.`;
				} else {
					errorMessage = `API error: ${response.status}`;
				}
				throw new Error(errorMessage);
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

		// Add to current game if one exists, otherwise create a new game
		if (
			!settingsData.currentGameId ||
			!settingsData.games.some((game: { id: any }) => game.id === settingsData.currentGameId)
		) {
			settings.createGame('Game ' + new Date().toLocaleDateString());
		}

		// Add batch to current game
		settings.addBatchToGame(settingsData.currentGameId, newBatch);

		isLoading = false;
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
		// Calculate score from current phrases
		totalScore = phrases.reduce((sum, phrase) => sum + (phrase.used ? phrase.points : 0), 0);
	}

	// Toggle phrase used status
	function togglePhraseUsed(index: number) {
		// Update the current phrase
		phrases[index].used = !phrases[index].used;

		// Find this phrase in current game's latest batch
		if (settingsData.currentGameId) {
			const currentGame = settingsData.games.find(
				(g: { id: any }) => g.id === settingsData.currentGameId
			);
			if (currentGame && currentGame.batches.length > 0) {
				// Update the latest batch
				const latestBatch = currentGame.batches[0];
				const phraseInBatch = latestBatch.phrases.find(
					(p: any, i: number) => i === index // Match by index in the batch
				);

				if (phraseInBatch) {
					phraseInBatch.used = phrases[index].used;
					settings.update((s) => s); // Trigger store update
				}
			}
		}

		calculateScore();
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

			// Update the current game's latest batch if it exists
			if (settingsData.currentGameId) {
				const currentGame = settingsData.games.find(
					(g: { id: any }) => g.id === settingsData.currentGameId
				);
				if (currentGame && currentGame.batches.length > 0) {
					const latestBatch = currentGame.batches[0];
					latestBatch.phrases = latestBatch.phrases.map((phrase: any) => ({
						...phrase,
						used: false
					}));
					settings.update((s) => s); // Trigger store update
				}
			}

			calculateScore();
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

	// Game management functions
	function createNewGame() {
		if (newGameName.trim()) {
			settings.createGame(newGameName.trim());
			newGameName = '';
			showGameDialog = false;
			initPhrases(); // Generate new phrases for new game
		}
	}

	function selectGame(gameId: string) {
		settings.setCurrentGame(gameId);

		// Load the latest phrases from this game
		const game = settingsData.games.find((g: { id: string }) => g.id === gameId);
		if (game && game.batches.length > 0) {
			// Get the latest batch
			const latestBatch = game.batches[0];
			phrases = JSON.parse(JSON.stringify(latestBatch.phrases)); // Deep copy
		} else {
			// No batches yet, initialize with new phrases
			initPhrases();
		}

		calculateScore();
	}

	function toggleGameCollapsed(gameId: string) {
		settings.toggleGameCollapsed(gameId);
	}

	function startEditGameName(game: Game) {
		isEditingGameName = true;
		currentEditGameId = game.id;
		newGameName = game.name;
	}

	function saveGameName() {
		if (newGameName.trim()) {
			settings.renameGame(currentEditGameId, newGameName.trim());
			isEditingGameName = false;
			currentEditGameId = '';
			newGameName = '';
		}
	}

	function cancelEditGameName() {
		isEditingGameName = false;
		currentEditGameId = '';
		newGameName = '';
	}

	function confirmRemoveGame(gameId: string) {
		gameToDelete = gameId;
		showConfirmDeleteGame = true;
	}

	function removeGame() {
		if (gameToDelete) {
			settings.removeGame(gameToDelete);
			showConfirmDeleteGame = false;
			gameToDelete = '';

			// If we have a current game, load its phrases
			if (settingsData.currentGameId) {
				const game = settingsData.games.find(
					(g: { id: any }) => g.id === settingsData.currentGameId
				);
				if (game && game.batches.length > 0) {
					phrases = JSON.parse(JSON.stringify(game.batches[0].phrases)); // Deep copy
				} else {
					// No batches yet, initialize with new phrases
					initPhrases();
				}
			}

			calculateScore();
		}
	}

	function confirmRemoveBatch(gameId: string, batchId: string) {
		batchToDelete = { gameId, batchId };
		showConfirmDeleteBatch = true;
	}

	function removeBatch() {
		if (batchToDelete.gameId && batchToDelete.batchId) {
			settings.removeBatch(batchToDelete.gameId, batchToDelete.batchId);

			// If we deleted the current batch, update the displayed phrases
			if (settingsData.currentGameId === batchToDelete.gameId) {
				const currentGame = settingsData.games.find(
					(g: { id: any }) => g.id === settingsData.currentGameId
				);
				if (currentGame && currentGame.batches.length > 0) {
					phrases = JSON.parse(JSON.stringify(currentGame.batches[0].phrases)); // Deep copy
				} else {
					// No more batches in this game, initialize new phrases
					initPhrases();
				}
			}

			showConfirmDeleteBatch = false;
			batchToDelete = { gameId: '', batchId: '' };
			calculateScore();
		}
	}

	// Close modal when clicking outside
	function closeModalOnOutsideClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (target.classList.contains('modal-backdrop')) {
			showSettingsModal = false;
			showGameDialog = false;
			showConfirmDeleteGame = false;
			showConfirmDeleteBatch = false;
			isConfirmingReset = false;
			isEditingGameName = false;
		}
	}

	// Get the most recent activity timestamp for a game
	function getLastActiveTime(game: Game): string {
		// If the game has batches, return the timestamp of the most recent batch
		if (game.batches && game.batches.length > 0) {
			// The batches are already sorted with newest first, so take the first one
			return game.batches[0].timestamp;
		}
		// Otherwise, return the game's creation timestamp
		return game.timestamp;
	}

	// Sort games by their last activity time (most recent first)
	function getSortedGames(): Game[] {
		if (!settingsData?.games) return [];

		// Create a copy of the games array to sort
		return [...settingsData.games].sort((a, b) => {
			const aTime = new Date(getLastActiveTime(a)).getTime();
			const bTime = new Date(getLastActiveTime(b)).getTime();
			return bTime - aTime; // Descending order (newer first)
		});
	}

	// Initialize game on component mount
	onMount(() => {
		// Subscribe to settings
		const unsubscribe = settings.subscribe((value) => {
			settingsData = value;
			console.log('Settings updated:', value);

			// Ensure settingsData has proper structure
			if (!settingsData.games) {
				settingsData.games = [];
			}

			// On initial load, if we have a current game, load its phrases
			if (settingsData.currentGameId) {
				const currentGame = settingsData.games.find(
					(g: { id: any }) => g.id === settingsData.currentGameId
				);
				if (currentGame && currentGame.batches && currentGame.batches.length > 0) {
					phrases = JSON.parse(JSON.stringify(currentGame.batches[0].phrases)); // Deep copy
					calculateScore();
				}
			}
		});

		// If we don't have any games yet or current game is invalid, create one
		setTimeout(() => {
			console.log('Checking if we need to create initial game:', settingsData);
			if (
				!settingsData?.games?.length ||
				!settingsData.currentGameId ||
				(settingsData.currentGameId &&
					!settingsData.games.some((g: { id: any }) => g.id === settingsData.currentGameId))
			) {
				console.log('Creating initial game...');
				settings.createGame('Game ' + new Date().toLocaleDateString());
				initPhrases();
			}
		}, 100); // Slight delay to ensure settings are loaded

		return unsubscribe;
	});
</script>

<svelte:head>
	<title>SlipTalk</title>
	<meta name="description" content="A sneaky phrase game to play with friends" />
</svelte:head>

<section class="min-h-screen bg-white px-4 py-8 transition-colors duration-200">
	<div class="max-w-md mx-auto">
		<!-- Header -->
		<div class="mb-8 text-center">
			<h1
				class="text-5xl font-bold bg-gradient-to-r from-blue-600 via-fuchsia-600 to-violet-600 inline-block text-transparent bg-clip-text mb-2"
			>
				SlipTalk
			</h1>
			<p class="text-gray-500">Sneak these phrases into conversation</p>

			<!-- Score Display -->
			<div class="mt-4 text-2xl font-bold text-gray-900">
				Score: <span class="text-sky-600">{totalScore}</span>
			</div>

			<!-- Current Game Display -->
			{#if settingsData && settingsData.currentGameId}
				{#each settingsData.games.filter((g: { id: any }) => g.id === settingsData.currentGameId) as currentGame}
					<div class="mt-2 text-sm text-gray-600">
						Game: {currentGame.name}
					</div>
				{/each}
			{/if}
		</div>

		<!-- Phrases Section (both loading and loaded states) -->
		<div class="space-y-4 mb-8">
			{#if isLoading}
				<!-- Loading State Cards -->
				{#each [1, 2, 3] as points}
					<div class="border border-gray-200 shadow-md p-4 transition-colors duration-200">
						<div class="flex justify-between items-start mb-2">
							<span
								class="inline-block px-2 py-1 bg-sky-100 text-sky-800 text-xs font-bold transition-colors duration-200"
							>
								{points}
								{points === 1 ? 'POINT' : 'POINTS'}
							</span>

							<button
								disabled
								class="text-sm px-3 py-1 border border-gray-300 shadow-sm opacity-60 transition-colors duration-200"
							>
								Mark as Used
							</button>
						</div>

						<div
							class="animate-pulse h-8 bg-gray-200 rounded w-full transition-colors duration-200"
						></div>
					</div>
				{/each}
			{:else}
				<!-- Phrase Cards -->
				{#if errorMessage}
					<div class="text-red-600 text-center">{errorMessage}</div>
				{/if}
				{#each phrases as phrase, i}
					<div
						class="border border-gray-200 shadow-md p-4 transition-all duration-200"
						class:opacity-50={phrase.used}
						class:bg-gray-50={phrase.used}
					>
						<div class="flex justify-between items-start mb-2">
							<span
								class="inline-block px-2 py-1 bg-sky-100 text-sky-800 text-xs font-bold transition-colors duration-200"
							>
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

						<p
							class="text-xl font-medium transition-colors duration-200"
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
				class="px-6 py-3 bg-black text-white font-bold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed w-full transition-all duration-200"
			>
				{isLoading ? 'Generating...' : 'Get New Phrases'}
			</button>

			<div class="flex space-x-2">
				<button
					on:click={toggleHistory}
					class="flex-1 px-6 py-2 border border-gray-300 font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center"
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
					on:click={() => {
						showGameDialog = true;
						newGameName = '';
					}}
					class="px-4 py-2 border border-gray-300 font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center"
					aria-label="New Game"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>

				<button
					on:click={toggleSettings}
					class="px-4 py-2 border border-gray-300 font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center"
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
		{#if showHistory && settingsData?.games?.length > 0}
			<div class="mt-8 border-t border-gray-200 pt-6 transition-colors duration-200">
				<h2 class="text-xl font-bold mb-4">Game History</h2>

				<div class="space-y-6">
					{#each getSortedGames() as game}
						<div class="border border-gray-200 rounded-md overflow-hidden">
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="bg-gray-50 p-3 flex justify-between items-start transition-colors duration-200 cursor-pointer"
								on:click={() => toggleGameCollapsed(game.id)}
							>
								<div class="flex-grow">
									{#if isEditingGameName && currentEditGameId === game.id}
										<div class="flex items-center">
											<input
												type="text"
												class="flex-grow border border-gray-300 rounded px-2 py-1 text-sm"
												bind:value={newGameName}
												on:keydown={(e) => {
													if (e.key === 'Enter') saveGameName();
													if (e.key === 'Escape') cancelEditGameName();
												}}
												autofocus
												on:click|stopPropagation={() => {}}
											/>
											<div class="flex space-x-1 ml-2">
												<button
													class="text-green-600 hover:text-green-800 p-1"
													on:click|stopPropagation={saveGameName}
													aria-label="Save game name"
												>
													<svg
														xmlns="http://www.w3.org/2000/svg"
														class="h-4 w-4"
														viewBox="0 0 20 20"
														fill="currentColor"
													>
														<path
															fill-rule="evenodd"
															d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 01-1.414-1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"
															clip-rule="evenodd"
														/>
													</svg>
												</button>
												<button
													class="text-red-600 hover:text-red-800 p-1"
													on:click|stopPropagation={cancelEditGameName}
													aria-label="Cancel editing"
												>
													<svg
														xmlns="http://www.w3.org/2000/svg"
														class="h-4 w-4"
														viewBox="0 0 20 20"
														fill="currentColor"
													>
														<path
															fill-rule="evenodd"
															d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
															clip-rule="evenodd"
														/>
													</svg>
												</button>
											</div>
										</div>
									{:else}
										<div>
											<div class="flex items-center">
												<span class="font-medium">{game.name}</span>
												<button
													class="text-gray-400 hover:text-gray-600 ml-1.5 opacity-70 hover:opacity-100"
													on:click|stopPropagation={() => startEditGameName(game)}
													aria-label="Edit game name"
												>
													<svg
														xmlns="http://www.w3.org/2000/svg"
														class="h-3.5 w-3.5"
														viewBox="0 0 20 20"
														fill="currentColor"
													>
														<path
															d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
														/>
													</svg>
												</button>
												{#if game.id === settingsData.currentGameId}
													<span class="bg-sky-100 text-sky-800 text-xs px-2 rounded-full ml-2"
														>Active</span
													>
												{/if}
											</div>
											<span class="text-xs text-gray-500 block mt-0.5">
												{formatDate(game.timestamp)}
											</span>
										</div>
									{/if}
								</div>
								<div class="flex space-x-2 items-center">
									{#if !isEditingGameName || currentEditGameId !== game.id}
										<button
											class="text-red-600 hover:text-red-800 p-1"
											on:click|stopPropagation={() => confirmRemoveGame(game.id)}
											aria-label="Delete game"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-4 w-4"
												viewBox="0 0 20 20"
												fill="currentColor"
											>
												<path
													fill-rule="evenodd"
													d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
													clip-rule="evenodd"
												/>
											</svg>
										</button>
										<button
											class="text-sky-600 hover:text-sky-800 p-1"
											on:click|stopPropagation={() => selectGame(game.id)}
											aria-label="Load this game"
											disabled={game.id === settingsData.currentGameId}
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-4 w-4"
												viewBox="0 0 20 20"
												fill="currentColor"
											>
												<path
													d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z"
												/>
											</svg>
										</button>
									{/if}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-5 w-5 text-gray-400 transform transition-transform duration-200"
										class:rotate-180={!game.isCollapsed}
										viewBox="0 0 20 20"
										fill="currentColor"
									>
										<path
											fill-rule="evenodd"
											d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
											clip-rule="evenodd"
										/>
									</svg>
								</div>
							</div>

							{#if !game.isCollapsed}
								<div class="divide-y divide-gray-100" transition:slide={{ duration: 200 }}>
									{#if game.batches.length === 0}
										<div class="p-4 text-center text-gray-500">No phrases yet.</div>
									{:else}
										{#each game.batches as batch}
											<div class="p-4 relative">
												<div class="text-xs text-gray-500 mb-2 font-medium flex justify-between">
													<span>{formatDate(batch.timestamp)}</span>
													<button
														class="text-red-600 hover:text-red-800"
														on:click|stopPropagation={() => confirmRemoveBatch(game.id, batch.id)}
														aria-label="Delete batch"
													>
														<svg
															xmlns="http://www.w3.org/2000/svg"
															class="h-4 w-4"
															viewBox="0 0 20 20"
															fill="currentColor"
														>
															<path
																fill-rule="evenodd"
																d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
																clip-rule="evenodd"
															/>
														</svg>
													</button>
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
															>
																{phrase.points}
															</span>
															<span
																class="text-sm"
																class:opacity-60={!phrase.used}
																class:line-through={phrase.used}
															>
																"{phrase.text}"
															</span>
														</div>
													{/each}
												</div>
											</div>
										{/each}
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Settings Modal -->
		{#if showSettingsModal}
			<div
				class="fixed inset-0 bg-black/10 backdrop-blur-[2px] flex items-center justify-center z-50 modal-backdrop"
				on:click={closeModalOnOutsideClick}
				on:keydown={(e) => e.key === 'Escape' && (showSettingsModal = false)}
				role="presentation"
				transition:fade={{ duration: 200 }}
			>
				<div
					class="bg-white rounded-xl shadow-2xl p-0 w-11/12 max-w-sm transition-colors duration-200"
					role="dialog"
					aria-modal="true"
					aria-labelledby="settings-modal-title"
					transition:fly={{ y: 10, duration: 300 }}
				>
					<div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
						<h3 id="settings-modal-title" class="text-xl font-bold">Settings</h3>
						<button
							on:click={() => (showSettingsModal = false)}
							class="text-gray-400 hover:text-gray-600 transition-colors"
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
						<!-- Reset Score -->
						<div>
							<button
								on:click={resetScore}
								class="text-white w-full py-2.5 px-4 rounded-lg shadow-sm transition-all duration-200 font-medium text-center"
								class:bg-red-600={!isConfirmingReset}
								class:hover:bg-red-700={!isConfirmingReset}
								class:bg-red-700={isConfirmingReset}
								class:hover:bg-red-800={isConfirmingReset}
								class:ring-4={isConfirmingReset}
								class:ring-red-300={isConfirmingReset}
							>
								{isConfirmingReset ? 'Tap again to confirm' : 'Reset Score'}
							</button>
							<p class="text-xs text-gray-500 mt-2 text-center">
								Keeps current phrases but marks them as unused
							</p>
						</div>

						<!-- Version Info -->
						<div class="text-center text-xs text-gray-500 pt-3 mt-3 border-t border-gray-200">
							SlipTalk v2.0
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- New Game Dialog -->
		{#if showGameDialog}
			<div
				class="fixed inset-0 bg-black/10 backdrop-blur-[2px] flex items-center justify-center z-50 modal-backdrop"
				on:click={closeModalOnOutsideClick}
				on:keydown={(e) => e.key === 'Escape' && (showGameDialog = false)}
				role="presentation"
				transition:fade={{ duration: 200 }}
			>
				<div
					class="bg-white rounded-xl shadow-2xl p-0 w-11/12 max-w-sm transition-colors duration-200"
					role="dialog"
					aria-modal="true"
					aria-labelledby="new-game-title"
					transition:fly={{ y: 10, duration: 300 }}
				>
					<div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
						<h3 id="new-game-title" class="text-xl font-bold">New Game</h3>
						<button
							on:click={() => (showGameDialog = false)}
							class="text-gray-400 hover:text-gray-600 transition-colors"
							aria-label="Close dialog"
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

					<div class="p-6">
						<div class="mb-4">
							<label for="game-name" class="block text-sm font-medium text-gray-700 mb-1"
								>Game Name</label
							>
							<input
								type="text"
								id="game-name"
								placeholder="Enter game name"
								class="w-full border border-gray-300 rounded-md px-3 py-2"
								bind:value={newGameName}
								on:keydown={(e) => e.key === 'Enter' && createNewGame()}
							/>
						</div>

						<button
							on:click={createNewGame}
							class="w-full bg-sky-600 text-white font-medium py-2 rounded-md hover:bg-sky-700 transition-colors"
						>
							Create & Generate Phrases
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Confirm Delete Game Dialog -->
		{#if showConfirmDeleteGame}
			<div
				class="fixed inset-0 bg-black/10 backdrop-blur-[2px] flex items-center justify-center z-50 modal-backdrop"
				on:click={closeModalOnOutsideClick}
				on:keydown={(e) => e.key === 'Escape' && (showConfirmDeleteGame = false)}
				role="presentation"
				transition:fade={{ duration: 200 }}
			>
				<div
					class="bg-white rounded-xl shadow-2xl p-0 w-11/12 max-w-sm transition-colors duration-200"
					role="dialog"
					aria-modal="true"
					transition:fly={{ y: 10, duration: 300 }}
				>
					<div class="p-6">
						<h3 class="text-lg font-medium mb-4">Delete Game?</h3>
						<p class="text-gray-600 mb-6">
							Are you sure you want to delete this game and all its phrases? This action cannot be
							undone.
						</p>

						<div class="flex space-x-3">
							<button
								on:click={() => (showConfirmDeleteGame = false)}
								class="flex-1 border border-gray-300 bg-white text-gray-700 py-2 rounded-md hover:bg-gray-50 transition-colors"
							>
								Cancel
							</button>
							<button
								on:click={removeGame}
								class="flex-1 bg-red-600 text-white font-medium py-2 rounded-md hover:bg-red-700 transition-colors"
							>
								Delete Game
							</button>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Confirm Delete Batch Dialog -->
		{#if showConfirmDeleteBatch}
			<div
				class="fixed inset-0 bg-black/10 backdrop-blur-[2px] flex items-center justify-center z-50 modal-backdrop"
				on:click={closeModalOnOutsideClick}
				on:keydown={(e) => e.key === 'Escape' && (showConfirmDeleteBatch = false)}
				role="presentation"
				transition:fade={{ duration: 200 }}
			>
				<div
					class="bg-white rounded-xl shadow-2xl p-0 w-11/12 max-w-sm transition-colors duration-200"
					role="dialog"
					aria-modal="true"
					transition:fly={{ y: 10, duration: 300 }}
				>
					<div class="p-6">
						<h3 class="text-lg font-medium mb-4">Delete Phrase Batch?</h3>
						<p class="text-gray-600 mb-6">
							Are you sure you want to delete this batch of phrases? This action cannot be undone.
						</p>

						<div class="flex space-x-3">
							<button
								on:click={() => (showConfirmDeleteBatch = false)}
								class="flex-1 border border-gray-300 bg-white text-gray-700 py-2 rounded-md hover:bg-gray-50 transition-colors"
							>
								Cancel
							</button>
							<button
								on:click={removeBatch}
								class="flex-1 bg-red-600 text-white font-medium py-2 rounded-md hover:bg-red-700 transition-colors"
							>
								Delete Batch
							</button>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</section>
