import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface Settings {
	theme: 'light' | 'dark';
	hasExplicitTheme: boolean;
}

// Default settings - explicitly set light theme as default
const defaultSettings: Settings = {
	theme: 'light',
	hasExplicitTheme: false
};

// Create the settings store
function createSettingsStore() {
	// Initialize with default light theme
	let initialSettings = { ...defaultSettings };

	// Only run browser-specific code if we're in the browser
	if (browser) {
		try {
			// First check localStorage for saved preferences
			const stored = localStorage.getItem('slipTalk:settings');
			if (stored) {
				const parsed = JSON.parse(stored);

				// Ensure we have valid theme values (as sometimes localStorage can have corrupted values)
				if (parsed && (parsed.theme === 'light' || parsed.theme === 'dark')) {
					initialSettings = {
						...initialSettings,
						...parsed,
						// Force hasExplicitTheme to true if there's a stored value
						// This ensures user preference always takes precedence
						hasExplicitTheme: true
					};
					console.log('Loaded stored theme:', initialSettings.theme);
				}
			}
			// If no explicit theme has been set, check system preference
			else if (!initialSettings.hasExplicitTheme) {
				// Use system preference for dark mode as the initial value
				const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
				initialSettings.theme = prefersDark ? 'dark' : 'light';
				console.log('Using system theme preference:', initialSettings.theme);
			}
		} catch (e) {
			console.error('Error initializing theme settings, defaulting to light theme', e);
			// On any error, ensure we default to light theme
			initialSettings = { ...defaultSettings };
		}
	}

	const { subscribe, set, update } = writable<Settings>(initialSettings);

	return {
		subscribe,
		set: (settings: Settings) => {
			try {
				if (browser) {
					localStorage.setItem('slipTalk:settings', JSON.stringify(settings));
					console.log('Saved theme setting:', settings.theme);
				}
				set(settings);
			} catch (e) {
				console.error('Error saving settings', e);
			}
		},
		update: (updater: (settings: Settings) => Settings) => {
			update((settings) => {
				try {
					const updatedSettings = updater(settings);
					if (browser) {
						localStorage.setItem('slipTalk:settings', JSON.stringify(updatedSettings));
						console.log('Updated theme setting:', updatedSettings.theme);
					}
					return updatedSettings;
				} catch (e) {
					console.error('Error updating settings', e);
					return settings;
				}
			});
		},
		reset: () => {
			try {
				set(defaultSettings);
				if (browser) {
					localStorage.setItem('slipTalk:settings', JSON.stringify(defaultSettings));
					console.log('Reset theme to default:', defaultSettings.theme);
				}
			} catch (e) {
				console.error('Error resetting settings', e);
			}
		},
		toggleTheme: () => {
			update((settings) => {
				try {
					// Explicitly type the theme to satisfy TypeScript
					const newTheme: 'light' | 'dark' = settings.theme === 'light' ? 'dark' : 'light';
					console.log('Toggling theme from', settings.theme, 'to', newTheme);

					const newSettings = {
						...settings,
						theme: newTheme,
						hasExplicitTheme: true // Mark that the user has made an explicit choice
					};

					if (browser) {
						localStorage.setItem('slipTalk:settings', JSON.stringify(newSettings));
					}

					return newSettings;
				} catch (e) {
					console.error('Error toggling theme', e);
					return settings;
				}
			});
		},
		// Add an explicit method to force light theme
		setLightTheme: () => {
			update((settings) => {
				const newSettings = {
					...settings,
					theme: 'light',
					hasExplicitTheme: true
				};

				if (browser) {
					localStorage.setItem('slipTalk:settings', JSON.stringify(newSettings));
					console.log('Explicitly setting light theme');
				}

				return newSettings;
			});
		}
	};
}

export const settings = createSettingsStore();
