import '../../css/main.css';
import { createEngine } from '../engine/Engine';
import { registerGameContent } from '../game/register';
import { AppUI } from './AppUI';

const engine = createEngine({
	world: '/assets/world.glb',
	assetBaseUrl: '/assets/'
});

// Register this game's entity kinds + glb conventions before the world loads.
registerGameContent(engine);

// AppUI subscribes to engine events; it must be constructed synchronously
// right after the engine so it is attached before the deferred init events fire.
// eslint-disable-next-line no-new
new AppUI(engine);
