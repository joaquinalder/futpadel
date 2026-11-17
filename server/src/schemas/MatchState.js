/**
 * Colyseus schema definitions for the match state.
 * The state is replicated automatically to all clients in the room.
 */

import { Schema, MapSchema, ArraySchema, type } from '@colyseus/schema';

export class PlayerState extends Schema {
  constructor() {
    super();
    this.name = '';
    this.team = 0;
    this.skin = 'red';
    this.x = 0; this.y = 0; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.rotY = 0;
    this.ready = false;
    this.connected = true;
    this.inUp = false; this.inDown = false; this.inLeft = false; this.inRight = false;
    this.inKick = false; this.inLob = false; this.inSmash = false; this.inHeader = false;
    this.aimX = 0; this.aimZ = 0;
    this.shotPower = 0;
  }
}
type('string')(PlayerState.prototype, 'name');
type('number')(PlayerState.prototype, 'team');
type('string')(PlayerState.prototype, 'skin');
type('number')(PlayerState.prototype, 'x');
type('number')(PlayerState.prototype, 'y');
type('number')(PlayerState.prototype, 'z');
type('number')(PlayerState.prototype, 'vx');
type('number')(PlayerState.prototype, 'vy');
type('number')(PlayerState.prototype, 'vz');
type('number')(PlayerState.prototype, 'rotY');
type('boolean')(PlayerState.prototype, 'ready');
type('boolean')(PlayerState.prototype, 'connected');
type('boolean')(PlayerState.prototype, 'inUp');
type('boolean')(PlayerState.prototype, 'inDown');
type('boolean')(PlayerState.prototype, 'inLeft');
type('boolean')(PlayerState.prototype, 'inRight');
type('boolean')(PlayerState.prototype, 'inKick');
type('boolean')(PlayerState.prototype, 'inLob');
type('boolean')(PlayerState.prototype, 'inSmash');
type('boolean')(PlayerState.prototype, 'inHeader');
type('number')(PlayerState.prototype, 'aimX');
type('number')(PlayerState.prototype, 'aimZ');
type('number')(PlayerState.prototype, 'shotPower');

export class BallState extends Schema {
  constructor() {
    super();
    this.x = 0; this.y = 1; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.spin = 0;
    this.held = '';
    this.lastShot = '';
  }
}
type('number')(BallState.prototype, 'x');
type('number')(BallState.prototype, 'y');
type('number')(BallState.prototype, 'z');
type('number')(BallState.prototype, 'vx');
type('number')(BallState.prototype, 'vy');
type('number')(BallState.prototype, 'vz');
type('number')(BallState.prototype, 'spin');
type('string')(BallState.prototype, 'held');
type('string')(BallState.prototype, 'lastShot');

export class ScoreState extends Schema {
  constructor() {
    super();
    this.pointsA = 0;
    this.pointsB = 0;
    this.currentSet = 0;
    this.gamesA = new ArraySchema();
    this.gamesB = new ArraySchema();
    this.setsA = 0;
    this.setsB = 0;
    this.pointsTextA = '0';
    this.pointsTextB = '0';
  }
}
type('number')(ScoreState.prototype, 'pointsA');
type('number')(ScoreState.prototype, 'pointsB');
type('number')(ScoreState.prototype, 'currentSet');
type(['number'])(ScoreState.prototype, 'gamesA');
type(['number'])(ScoreState.prototype, 'gamesB');
type('number')(ScoreState.prototype, 'setsA');
type('number')(ScoreState.prototype, 'setsB');
type('string')(ScoreState.prototype, 'pointsTextA');
type('string')(ScoreState.prototype, 'pointsTextB');

export class MatchState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.ball = new BallState();
    this.score = new ScoreState();
    this.phase = 'waiting';
    this.servingTeam = 0;
    this.serveBox = 0;
    this.lastTouchTeam = -1;
    this.lastTouchSession = '';
    this.bouncesOnSide = 0;
    this.sideOfBall = 0;
    this.crossedNet = false;
    this.court = 'classic';
    this.message = '';
    this.tick = 0;
  }
}
type({ map: PlayerState })(MatchState.prototype, 'players');
type(BallState)(MatchState.prototype, 'ball');
type(ScoreState)(MatchState.prototype, 'score');
type('string')(MatchState.prototype, 'phase');
type('number')(MatchState.prototype, 'servingTeam');
type('number')(MatchState.prototype, 'serveBox');
type('number')(MatchState.prototype, 'lastTouchTeam');
type('string')(MatchState.prototype, 'lastTouchSession');
type('number')(MatchState.prototype, 'bouncesOnSide');
type('number')(MatchState.prototype, 'sideOfBall');
type('boolean')(MatchState.prototype, 'crossedNet');
type('string')(MatchState.prototype, 'court');
type('string')(MatchState.prototype, 'message');
type('number')(MatchState.prototype, 'tick');
