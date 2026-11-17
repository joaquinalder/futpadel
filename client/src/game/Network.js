/**
 * Network — thin wrapper around a Colyseus Room handle.
 * Currently delegates most behaviour to Game.js; this file exists to keep
 * the boundary clean and to centralise any future reconnect / retry logic.
 */

export class Network {
  constructor(room) {
    this.room = room;
  }

  send(type, payload) {
    if (this.room) this.room.send(type, payload);
  }

  leave() {
    if (this.room) this.room.leave();
    this.room = null;
  }
}

export async function connectAndJoin({ Client, endpoint, roomName, options }) {
  const client = new Client(endpoint);
  const room = await client.joinOrCreate(roomName, options);
  return { client, room };
}
