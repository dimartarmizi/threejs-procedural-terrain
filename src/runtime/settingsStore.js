export class SettingsStore {
	constructor(storageKey, defaultSettings) {
		this.storageKey = storageKey;
		this.defaultSettings = defaultSettings;
	}

	cloneDefaults() {
		return { ...this.defaultSettings };
	}

	load() {
		try {
			const saved = localStorage.getItem(this.storageKey);
			if (!saved) return this.cloneDefaults();

			const parsed = JSON.parse(saved);
			return { ...this.cloneDefaults(), ...parsed };
		} catch (error) {
			return this.cloneDefaults();
		}
	}

	save(settings) {
		try {
			localStorage.setItem(this.storageKey, JSON.stringify(settings));
		} catch (error) {
		}
	}

	reset() {
		return this.cloneDefaults();
	}
}