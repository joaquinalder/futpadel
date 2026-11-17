import { createGameServer } from './gameServer.js';
import { NET } from '../../shared/constants.js';

const { gameServer } = createGameServer();
await gameServer.listen(NET.PORT, '127.0.0.1');
console.log(`[futpadel] server listening on ${NET.URL()}`);
