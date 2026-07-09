import '../css/main.css';
import { World } from './world/World';
import { AppUI } from './app/AppUI';

const world = new World({
	world: '/assets/world.glb',
	assetBaseUrl: '/assets/'
});

// AppUI subscribes to engine events; it must be constructed synchronously
// right after the engine so it is attached before the deferred init events fire.
// eslint-disable-next-line no-new
new AppUI(world);
