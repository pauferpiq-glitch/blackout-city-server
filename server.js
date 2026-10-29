'use strict';
// Servidor multiplayer de Blackout City (Node.js + WebSocket "ws")
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const MAX_PLAYERS = 8;
const MAX_FOOT_SPEED = 70;   // unitats/segon (marge ampli, inclou cotxes)
const BOUND = 900;           // límit del món
const rooms = new Map();     // codi -> { host, started, players: Map(id -> player) }

// Servidor HTTP mínim (Render el fa servir per comprovar que està viu)
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Blackout City multiplayer: servidor en marxa\n');
});
const wss = new WebSocketServer({ server });

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  let c;
  do { c = Array.from({ length: 6 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join(''); }
  while (rooms.has(c));
  return c;
}
const cleanName = s => String(s || 'Jugador').replace(/[<>&"'`]/g, '').trim().slice(0, 16) || 'Jugador';
const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const send = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
const broadcast = (room, o, except) => {
  for (const p of room.players.values()) if (p.ws !== except) send(p.ws, o);
};
const playerList = room =>
  Object.fromEntries([...room.players.values()].map(p => [p.id, p.name]));

function leave(ws) {
  const code = ws.room;
  const room = rooms.get(code);
  if (!room) return;
  const p = room.players.get(ws.id);
  room.players.delete(ws.id);
  ws.room = null;
  if (p) broadcast(room, { t: 'left', id: p.id, name: p.name });
  if (room.players.size === 0) { rooms.delete(code); return; }
  if (room.host === ws.id) room.host = room.players.keys().next().value;
  broadcast(room, { t: 'pl', players: playerList(room), host: room.host });
}

function addPlayer(ws, code, room, name) {
  ws.room = code;
  room.players.set(ws.id, {
    id: ws.id, name, ws, code,
    x: 0, z: 0, h: 0, a: 0, y: 0, f: 0, car: 0,
    last: Date.now(), has: false
  });
}

wss.on('connection', ws => {
  ws.id = Math.random().toString(36).slice(2, 9);
  ws.room = null;
  ws.alive = Date.now();
  ws.count = 0;

  ws.on('pong', () => { ws.alive = Date.now(); });

  ws.on('message', data => {
    ws.alive = Date.now();
    if (++ws.count > 60) return;          // límit de missatges per segon
    let m;
    try { m = JSON.parse(data); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;

    if (m.t === 'create' && !ws.room) {
      const code = newCode();
      const room = { host: ws.id, started: false, players: new Map() };
      rooms.set(code, room);
      addPlayer(ws, code, room, cleanName(m.name));
      send(ws, { t: 'created', code, id: ws.id, host: room.host, players: playerList(room) });
      return;
    }

    if (m.t === 'join' && !ws.room) {
      const code = String(m.code || '').toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) return send(ws, { t: 'err', m: 'Codi de partida incorrecte.' });
      if (room.players.size >= MAX_PLAYERS) return send(ws, { t: 'err', m: 'La partida està plena.' });
      const name = cleanName(m.name);
      addPlayer(ws, code, room, name);
      send(ws, { t: 'joined', code, id: ws.id, host: room.host, players: playerList(room) });
      broadcast(room, { t: 'join', name }, ws);
      broadcast(room, { t: 'pl', players: playerList(room), host: room.host }, ws);
      if (room.started) send(ws, { t: 'start' });
      return;
    }

    const room = rooms.get(ws.room);
    if (!room) return;
    const p = room.players.get(ws.id);
    if (!p) return;

    if (m.t === 'start' && room.host === ws.id) {
      room.started = true;
      broadcast(room, { t: 'start' });
    } else if (m.t === 'st' && room.started) {
      const now = Date.now();
      const dt = Math.max(0.02, (now - p.last) / 1000);
      p.last = now;
      let x = clamp(num(m.x), -BOUND, BOUND), z = clamp(num(m.z), -BOUND, BOUND);
      if (p.has) {                          // validació bàsica: no teletransport
        const lim = MAX_FOOT_SPEED * dt + 6;
        const d = Math.hypot(x - p.x, z - p.z);
        if (d > lim) { x = p.x + (x - p.x) * lim / d; z = p.z + (z - p.z) * lim / d; }
      }
      p.has = true;
      p.x = x; p.z = z;
      p.h = num(m.h); p.a = clamp(num(m.a), 0, 80);
      p.y = clamp(num(m.y), -5, 60); p.f = num(m.f) | 0;
      if (Array.isArray(m.car) && m.car.length === 4) {
        p.car = [clamp(num(m.car[0]), -BOUND, BOUND), clamp(num(m.car[1]), -BOUND, BOUND),
                 num(m.car[2]), num(m.car[3]) & 0xffffff];
      } else p.car = 0;
    } else if (m.t === 'chat') {
      const text = String(m.m || '').replace(/[<>]/g, '').trim().slice(0, 200);
      if (text) broadcast(room, { t: 'chat', n: p.name, m: text });
    } else if (m.t === 'leave') {
      leave(ws);
    }
  });

  ws.on('close', () => leave(ws));
  ws.on('error', () => {});
});

// Envia l'estat de tots els jugadors 10 cops per segon
setInterval(() => {
  for (const room of rooms.values()) {
    if (!room.started) continue;
    const arr = [...room.players.values()].filter(p => p.has)
      .map(p => ({ id: p.id, x: p.x, z: p.z, h: p.h, a: p.a, y: p.y, f: p.f, car: p.car }));
    if (arr.length) broadcast(room, { t: 'snap', p: arr });
  }
}, 100);

// Reinicia el comptador de missatges i elimina connexions mortes (jugadors fantasma)
setInterval(() => {
  const now = Date.now();
  for (const ws of wss.clients) {
    ws.count = 0;
    if (now - ws.alive > 15000) { ws.terminate(); continue; }
    try { ws.ping(); } catch (e) {}
  }
}, 1000);

server.listen(PORT, () => console.log('Servidor multiplayer escoltant al port ' + PORT));
