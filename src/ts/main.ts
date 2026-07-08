import '../css/main.css';
import { World } from './world/World';

// eslint-disable-next-line no-new
new World({
	world: '/assets/world.glb',
	assetBaseUrl: '/assets/'
});
