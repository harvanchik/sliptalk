import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface Phrase {
	text: string;
	points: number;
	used?: boolean;
}

export interface PhraseBatch {
	phrases: Phrase[];
	timestamp: string; // ISO string format
	id: string; // Unique identifier for each batch
}

export interface Game {
	id: string;
	name: string;
	timestamp: string;
	batches: PhraseBatch[];
	isCollapsed?: boolean;
}

export interface Settings {
	games: Game[];
	currentGameId: string | null;
}

// Default settings
const defaultSettings: Settings = {
	games: [],
	currentGameId: null
};

// Storage key for consistency
const STORAGE_KEY = 'slipTalk:settings';

// Create the settings store
function createSettingsStore() {
	// Initialize with default settings
	let initialSettings = { ...defaultSettings };

	// Load settings from localStorage if available
	if (browser) {
		const savedSettings = localStorage.getItem(STORAGE_KEY);
		if (savedSettings) {
			try {
				initialSettings = JSON.parse(savedSettings);
				console.log('Loaded settings from storage:', initialSettings);
			} catch (e) {
				console.error('Error parsing settings', e);
			}
		}
	}

	const { subscribe, set, update } = writable<Settings>(initialSettings);

	// Helper function to save settings to localStorage
	function saveToLocalStorage(settings: Settings) {
		if (browser) {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
				console.log('Saved settings to storage');
			} catch (e) {
				console.error('Error saving settings to localStorage', e);
			}
		}
	}

	return {
		subscribe,
		set: (settings: Settings) => {
			try {
				saveToLocalStorage(settings);
				set(settings);
			} catch (e) {
				console.error('Error saving settings', e);
			}
		},
		update: (updater: (settings: Settings) => Settings) => {
			update((settings) => {
				try {
					const updatedSettings = updater(settings);
					saveToLocalStorage(updatedSettings);
					return updatedSettings;
				} catch (e) {
					console.error('Error updating settings', e);
					return settings;
				}
			});
		},
		reset: () => {
			try {
				saveToLocalStorage(defaultSettings);
				set(defaultSettings);
			} catch (e) {
				console.error('Error resetting settings', e);
			}
		},
		// Game management functions
		createGame: (name: string = 'New Game') => {
			update((settings) => {
				// Ensure settings object has a games property
				if (!settings.games) {
					settings.games = [];
				}

				const newGame: Game = {
					id: crypto.randomUUID(),
					name,
					timestamp: new Date().toISOString(),
					batches: [],
					isCollapsed: false
				};

				settings.games.push(newGame);
				settings.currentGameId = newGame.id;

				// Explicitly save to localStorage after creating a game
				saveToLocalStorage(settings);
				console.log('Created new game:', newGame.name);

				return settings;
			});
		},
		addBatchToGame: (gameId: string, batch: PhraseBatch) => {
			update((settings) => {
				// Ensure settings object has a games property
				if (!settings.games) {
					settings.games = [];
					return settings;
				}

				const game = settings.games.find((g) => g.id === gameId);
				if (game) {
					// Ensure game has a batches property
					if (!game.batches) {
						game.batches = [];
					}
					game.batches.unshift(batch);

					// Explicitly save to localStorage after adding a batch
					saveToLocalStorage(settings);
					console.log('Added batch to game:', game.name);
				} else {
					console.error('Game not found for batch addition:', gameId);
				}
				return settings;
			});
		},
		removeBatch: (gameId: string, batchId: string) => {
			update((settings) => {
				// Ensure settings object has a games property
				if (!settings.games) {
					settings.games = [];
					return settings;
				}

				const game = settings.games.find((g) => g.id === gameId);
				if (game && game.batches) {
					game.batches = game.batches.filter((batch) => batch.id !== batchId);
					saveToLocalStorage(settings);
					console.log('Removed batch from game:', game.name);
				}
				return settings;
			});
		},
		removeGame: (gameId: string) => {
			update((settings) => {
				// Ensure settings object has a games property
				if (!settings.games) {
					settings.games = [];
					return settings;
				}

				settings.games = settings.games.filter((game) => game.id !== gameId);

				// If we removed the current game, set to the first available or null
				if (settings.currentGameId === gameId) {
					settings.currentGameId = settings.games.length > 0 ? settings.games[0].id : null;
				}

				saveToLocalStorage(settings);
				console.log('Removed game with ID:', gameId);
				return settings;
			});
		},
		setCurrentGame: (gameId: string) => {
			update((settings) => {
				// Ensure gameId is valid if there are games
				if (settings.games && settings.games.length > 0) {
					const gameExists = settings.games.some((g) => g.id === gameId);
					if (gameExists) {
						settings.currentGameId = gameId;
						saveToLocalStorage(settings);
						console.log('Set current game to:', gameId);
					}
				}
				return settings;
			});
		},
		toggleGameCollapsed: (gameId: string) => {
			update((settings) => {
				// Ensure settings object has a games property
				if (!settings.games) {
					settings.games = [];
					return settings;
				}

				const game = settings.games.find((g) => g.id === gameId);
				if (game) {
					game.isCollapsed = !game.isCollapsed;
					saveToLocalStorage(settings);
				}
				return settings;
			});
		},
		renameGame: (gameId: string, newName: string) => {
			update((settings) => {
				// Ensure settings object has a games property
				if (!settings.games) {
					settings.games = [];
					return settings;
				}

				const game = settings.games.find((g) => g.id === gameId);
				if (game) {
					game.name = newName;
					saveToLocalStorage(settings);
					console.log('Renamed game to:', newName);
				}
				return settings;
			});
		}
	};
}

export const settings = createSettingsStore();
