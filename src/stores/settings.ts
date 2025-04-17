import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface Settings {
	// Removing theme option entirely
}

// Default settings - no more theme settings
const defaultSettings: Settings = {
	// Empty object since we no longer need theme settings
};

// Create the settings store
function createSettingsStore() {
	// Initialize with default settings
	let initialSettings = { ...defaultSettings };

	const { subscribe, set, update } = writable<Settings>(initialSettings);

	return {
		subscribe,
		set: (settings: Settings) => {
			try {
				if (browser) {
					localStorage.setItem('slipTalk:settings', JSON.stringify(settings));
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
				}
			} catch (e) {
				console.error('Error resetting settings', e);
			}
		}
	};
}

export const settings = createSettingsStore();
