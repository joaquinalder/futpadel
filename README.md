# Futpadel

Prototipo 3D de fútbol-pádel para dos jugadores. Three.js dibuja la cancha, los jugadores y la pelota. El servidor Colyseus decide la física, los saques y el puntaje y sincroniza el estado por WebSocket. El modo práctica enfrenta a un rival controlado por el servidor. Los avatares de esta versión se generan en código.

## Jugar en el navegador

Con Node.js 22.12 o superior, desde la raíz:

```bash
npm ci
npm run dev:web
```

Abrí [127.0.0.1:5173](http://127.0.0.1:5173). Elegí **Práctica** para jugar contra la CPU o abrí dos pestañas y elegí la misma cancha en **Partida rápida**. El servidor escucha en la máquina local en el puerto 2567.

| Acción | Teclado |
| --- | --- |
| Moverse | WASD |
| Apuntar | Mouse o flechas |
| Saque o tiro | Espacio |
| Globo | Shift |
| Remate | Ctrl |
| Cabeza o pecho | E |

## Arquitectura y pruebas

- `client/` contiene la interfaz, el renderizador y el lanzador opcional de Electron (`npm start`).
- `server/` contiene el servidor, las salas, las reglas y las pruebas de integración con clientes WebSocket reales.
- `shared/` comparte las constantes de cancha, física y catálogo entre navegador y servidor.

Usá `npm test` para verificar el saque sincronizado y que una partida contra la CPU quede aislada del emparejamiento de dos jugadores. `npm run build:client` genera el cliente web. La demo está preparada para ejecutarse en loopback.
