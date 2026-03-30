export class TextureRegistry {
	static sets = new Map([
		['grass', {
			color: '/textures/grass_color.jpg'
		}],
		['dirt', {
			color: '/textures/dirt_color.jpg'
		}],
		['dry_grass', {
			color: '/textures/dry_grass_color.jpg'
		}],
		['mud', {
			color: '/textures/mud_color.jpg'
		}],
		['rock', {
			color: '/textures/rock_color.jpg'
		}],
		['cliff', {
			color: '/textures/cliff_color.jpg'
		}],
		['sand', {
			color: '/textures/sand_color.jpg'
		}],
		['snow', {
			color: '/textures/snow_color.jpg'
		}],
		['road', {
			color: '/textures/road_color.jpg'
		}]
	]);

	static registerSet(name, definition) {
		this.sets.set(name, {
			color: definition.color || null
		});
	}

	static getSet(name = 'grass005') {
		return this.sets.get(name) || this.sets.get('grass') || {
			color: null
		};
	}

	static resolveTexturePath(name, slot) {
		const set = this.getSet(name);
		return set[slot] || null;
	}

	static registerStandardTerrainSet(name, baseName, extension = 'jpg', folder = '/textures') {
		this.registerSet(name, {
			color: `${folder}/${baseName}.${extension}`
		});
	}
}