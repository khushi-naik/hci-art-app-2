"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_node_http = require("node:http");
var import_next = __toESM(require("next"));
var import_env = require("@next/env");

// src/server/socket.ts
var import_socket = require("socket.io");
var import_zod2 = require("zod");

// src/server/game.ts
var import_node_crypto = require("node:crypto");

// src/lib/shared/model.ts
var import_zod = require("zod");
var WIDTH = 1200;
var HEIGHT = 800;
var nameSchema = import_zod.z.string().trim().min(2).max(24).refine(
  (s) => !/[\p{Cc}\p{Cf}]/u.test(s),
  "Please use a simple display name."
);
var codeSchema = import_zod.z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{8}$/);
var settingsSchema = import_zod.z.object({
  rounds: import_zod.z.number().int().min(1).max(3),
  minutes: import_zod.z.union([import_zod.z.literal(2), import_zod.z.literal(3), import_zod.z.literal(4), import_zod.z.literal(5)])
}).strict();
var coord = import_zod.z.number().finite().min(0).max(WIDTH);
var objectSchema = import_zod.z.object({
  type: import_zod.z.enum(["brush", "eraser", "line", "rect", "ellipse"]),
  points: import_zod.z.array(coord).min(4).max(4e3).refine(
    (p) => p.length % 2 === 0 && p.every((v, i) => i % 2 === 0 || v <= HEIGHT),
    "Invalid coordinates"
  ),
  color: import_zod.z.string().regex(/^#[0-9a-fA-F]{6}$/),
  width: import_zod.z.number().finite().min(1).max(64)
}).strict().superRefine((s, ctx) => {
  if (!["brush", "eraser"].includes(s.type) && s.points.length !== 4)
    ctx.addIssue({ code: "custom", message: "Shapes need two points" });
});
var overlaySchema = import_zod.z.array(objectSchema).max(400).refine(
  (objects) => objects.reduce((n, o) => n + o.points.length, 0) <= 4e4,
  "Too many points"
);
var writeSchema = import_zod.z.object({
  turnId: import_zod.z.string().uuid(),
  sequence: import_zod.z.number().int().min(0).max(1e9),
  overlay: overlaySchema
}).strict();

// src/lib/shared/prompts.ts
var prompts = [
  "A peaceful place that exists only in your imagination.",
  "A garden where the flowers hold tiny worlds.",
  "A little house resting on a cloud.",
  "A river carrying wishes toward the sea.",
  "A forest lit by gentle floating lanterns.",
  "A friendly creature taking a quiet afternoon walk.",
  "A cup of tea with a whole landscape inside.",
  "An island shaped like a comforting memory.",
  "A night sky with constellations nobody has named.",
  "A library grown from the branches of a tree.",
  "A tiny boat exploring a very big pond.",
  "A window looking out onto a world of soft colors.",
  "A place where the moon comes to rest.",
  "A staircase that leads to a secret garden.",
  "A quiet celebration among woodland friends.",
  "A mountain wrapped in a cozy scarf.",
  "A collection of little things that bring you joy.",
  "A sleepy town beneath an enormous flower.",
  "A bridge between two imaginary seasons.",
  "A gentle breeze made visible.",
  "A sea where the waves are made of leaves.",
  "A doorway to somewhere wonderfully unexpected.",
  "A picnic shared with the stars.",
  "A tree whose leaves are tiny umbrellas.",
  "A warm light on a rainy evening.",
  "A landscape made from rounded stones.",
  "A floating garden traveling slowly through the sky.",
  "A friendly lighthouse at the edge of the world.",
  "A constellation of ordinary beautiful things.",
  "A place where every path leads to a small surprise.",
  "A patchwork meadow full of unusual plants.",
  "A restful moment for an imaginary explorer.",
  "A nest big enough to hold a village.",
  "A sunrise over a landscape of your favorite colors.",
  "A gentle giant tending a miniature garden.",
  "A map of a place that feels welcoming."
];

// src/server/game.ts
var PREP_MS = 1e4;
var RECONNECT_MS = 3e4;
var EMPTY_TTL = 30 * 60 * 1e3;
var LOBBY_TTL = 2 * 60 * 60 * 1e3;
var REVEAL_TTL = 60 * 60 * 1e3;
var hash = (token) => (0, import_node_crypto.createHash)("sha256").update(token).digest();
var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
var Game = class {
  constructor(repo, now = () => Date.now(), changed = () => {
  }) {
    this.repo = repo;
    this.now = now;
    this.changed = changed;
  }
  repo;
  now;
  changed;
  notify(r) {
    r.revision++;
    r.touchedAt = this.now();
    this.changed(r);
  }
  publicState(r) {
    return {
      code: r.code,
      hostId: r.hostId,
      players: r.players.map((p) => ({
        id: p.id,
        name: p.name,
        connected: !!p.socketId,
        ready: p.ready
      })),
      settings: { ...r.settings },
      phase: r.phase,
      prompt: r.prompt,
      order: [...r.order],
      roundIndex: r.order.length ? Math.floor(r.slot / r.order.length) : 0,
      turnIndex: r.order.length ? r.slot % r.order.length : 0,
      activePlayerId: r.activePlayerId,
      phaseStartedAt: r.phaseStartedAt,
      phaseEndsAt: r.phaseEndsAt,
      revision: r.revision,
      turnId: r.turnId,
      serverNow: this.now()
    };
  }
  create(name, socketId) {
    if (this.repo.size >= 100)
      throw Error("The studio is full. Please try again later.");
    let code = "";
    do {
      code = Array.from(
        { length: 8 },
        () => alphabet[(0, import_node_crypto.randomInt)(alphabet.length)]
      ).join("");
    } while (this.repo.get(code));
    const { player, token } = this.player(name, socketId);
    const r = {
      code,
      hostId: player.id,
      players: [player],
      settings: { rounds: 1, minutes: 4 },
      phase: "LOBBY",
      prompt: this.prompt(),
      order: [],
      slot: 0,
      activePlayerId: null,
      phaseStartedAt: this.now(),
      phaseEndsAt: null,
      remaining: 0,
      revision: 0,
      turnId: null,
      layers: [],
      checkpoint: [],
      sequence: -1,
      touchedAt: this.now(),
      emptySince: null
    };
    this.repo.set(r);
    this.notify(r);
    return { code, playerId: player.id, token };
  }
  player(name, socketId) {
    const token = (0, import_node_crypto.randomBytes)(32).toString("base64url");
    return {
      token,
      player: {
        id: (0, import_node_crypto.randomUUID)(),
        name: nameSchema.parse(name),
        tokenHash: hash(token),
        socketId,
        ready: false
      }
    };
  }
  room(code) {
    const r = this.repo.get(codeSchema.parse(code));
    if (!r)
      throw Error("This room no longer exists. You can create a fresh one.");
    return r;
  }
  join(code, name, socketId) {
    const r = this.room(code);
    if (r.phase !== "LOBBY")
      throw Error("This session has begun. Only returning guests can rejoin.");
    if (r.players.length >= 5)
      throw Error("This room already has five guests.");
    const { player, token } = this.player(name, socketId);
    r.players.push(player);
    r.emptySince = null;
    this.notify(r);
    return { code: r.code, playerId: player.id, token };
  }
  resume(seat, socketId) {
    const r = this.room(seat.code);
    const p = r.players.find((p2) => p2.id === seat.playerId);
    const digest = hash(seat.token);
    if (!p || !(0, import_node_crypto.timingSafeEqual)(p.tokenHash, digest))
      throw Error("This seat could not be restored.");
    const old = p.socketId;
    p.socketId = socketId;
    r.emptySince = null;
    if (r.phase === "PAUSED_RECONNECT" && r.activePlayerId === p.id) {
      if (this.now() >= r.phaseEndsAt) {
        this.advance(r);
      } else {
        r.phase = "DRAWING";
        r.phaseStartedAt = this.now();
        r.phaseEndsAt = this.now() + r.remaining;
      }
    }
    this.notify(r);
    return { r, p, old };
  }
  member(code, playerId, socketId) {
    const r = this.room(code), p = r.players.find((p2) => p2.id === playerId);
    if (!p || p.socketId !== socketId)
      throw Error("Your connection no longer owns this seat.");
    return { r, p };
  }
  host(r, p) {
    if (r.hostId !== p.id) throw Error("Only the host can do that.");
  }
  lobby(r) {
    if (r.phase !== "LOBBY")
      throw Error("This action is available before the session starts.");
  }
  ready(r, p, value) {
    this.lobby(r);
    p.ready = value;
    this.notify(r);
  }
  settings(r, p, input) {
    this.host(r, p);
    this.lobby(r);
    r.settings = settingsSchema.parse(input);
    this.notify(r);
  }
  prompt() {
    return prompts[(0, import_node_crypto.randomInt)(prompts.length)];
  }
  regenerate(r, p) {
    this.host(r, p);
    this.lobby(r);
    let next2 = this.prompt();
    while (next2 === r.prompt) next2 = this.prompt();
    r.prompt = next2;
    this.notify(r);
  }
  start(r, p) {
    this.host(r, p);
    this.lobby(r);
    const present = r.players.filter((p2) => p2.socketId);
    if (present.length < 2 || present.some((p2) => !p2.ready))
      throw Error(
        "At least two connected guests are needed, and everyone connected must be ready."
      );
    r.order = present.map((p2) => p2.id);
    for (let i = r.order.length - 1; i > 0; i--) {
      const j = (0, import_node_crypto.randomInt)(i + 1);
      [r.order[i], r.order[j]] = [r.order[j], r.order[i]];
    }
    r.slot = 0;
    this.begin(r);
    this.notify(r);
  }
  begin(r) {
    r.phase = "DRAWING";
    r.activePlayerId = r.order[r.slot % r.order.length];
    r.turnId = (0, import_node_crypto.randomUUID)();
    r.checkpoint = [];
    r.sequence = -1;
    r.phaseStartedAt = this.now();
    r.phaseEndsAt = this.now() + r.settings.minutes * 6e4;
  }
  advance(r) {
    r.checkpoint = [];
    r.sequence = -1;
    r.turnId = null;
    r.slot++;
    while (r.slot < r.order.length * r.settings.rounds && !r.players.find((p) => p.id === r.order[r.slot % r.order.length])?.socketId)
      r.slot++;
    r.phaseStartedAt = this.now();
    if (r.slot >= r.order.length * r.settings.rounds) {
      r.slot = Math.max(0, r.order.length * r.settings.rounds - 1);
      r.phase = "REVEAL";
      r.activePlayerId = null;
      r.phaseEndsAt = null;
    } else {
      r.phase = "PREPARING";
      r.activePlayerId = r.order[r.slot % r.order.length];
      r.phaseEndsAt = this.now() + PREP_MS;
    }
  }
  authorized(r, p) {
    if (!r.players.includes(p)) throw Error("Room membership is required.");
    if (r.phase !== "REVEAL" && !(r.phase === "DRAWING" && r.activePlayerId === p.id && this.now() < r.phaseEndsAt))
      throw Error(
        "The artwork is resting until your turn or the final reveal."
      );
    return {
      code: r.code,
      turnId: r.turnId,
      layers: structuredClone(r.layers),
      overlay: r.phase === "REVEAL" ? [] : structuredClone(r.checkpoint),
      sequence: r.sequence,
      revision: r.revision
    };
  }
  write(r, p, input, finish = false) {
    const data = writeSchema.parse(input);
    if (r.phase !== "DRAWING" || r.activePlayerId !== p.id || r.turnId !== data.turnId || this.now() >= r.phaseEndsAt)
      throw Error("This drawing turn has ended or is not yours.");
    const points = (overlays) => overlays.reduce(
      (total2, layer) => total2 + layer.reduce((n, m) => n + m.points.length, 0),
      0
    );
    if (points([...r.layers, data.overlay]) > 2e5)
      throw Error(
        "This shared canvas has reached its detail limit. Please simplify your current turn."
      );
    let total = points([data.overlay]);
    for (const other of this.repo.values())
      total += points(other.layers) + (other === r ? 0 : points([other.checkpoint]));
    if (total > 2e6)
      throw Error(
        "The studio is at capacity. Please try saving again in a moment."
      );
    if (data.sequence <= r.sequence)
      throw Error("This checkpoint is older than the saved drawing.");
    r.checkpoint = data.overlay;
    r.sequence = data.sequence;
    if (finish) {
      r.layers.push(structuredClone(r.checkpoint));
      this.advance(r);
      this.notify(r);
    }
    return { sequence: data.sequence };
  }
  disconnect(code, id, socketId, leave = false) {
    const r = this.repo.get(code), p = r?.players.find((p2) => p2.id === id);
    if (!r || !p || p.socketId !== socketId) return;
    p.socketId = null;
    p.ready = false;
    if (r.phase === "DRAWING" && r.activePlayerId === id) {
      r.remaining = Math.max(0, r.phaseEndsAt - this.now());
      if (r.remaining > 0) {
        r.phase = "PAUSED_RECONNECT";
        r.phaseStartedAt = this.now();
        r.phaseEndsAt = this.now() + RECONNECT_MS;
      } else {
        r.layers.push(r.checkpoint);
        this.advance(r);
      }
    }
    if (r.phase === "LOBBY") {
      if (leave) r.players = r.players.filter((x) => x.id !== id);
      if (r.hostId === id) {
        const next2 = r.players.find((x) => x.socketId);
        if (next2) r.hostId = next2.id;
      }
    }
    if (!r.players.some((p2) => p2.socketId)) r.emptySince ??= this.now();
    this.notify(r);
  }
  replay(r, p) {
    this.host(r, p);
    if (r.phase !== "REVEAL") throw Error("Wait for the final reveal first.");
    r.phase = "LOBBY";
    r.layers = [];
    r.checkpoint = [];
    r.order = [];
    r.slot = 0;
    r.turnId = null;
    r.activePlayerId = null;
    r.phaseEndsAt = null;
    r.phaseStartedAt = this.now();
    r.prompt = this.prompt();
    r.players.forEach((p2) => p2.ready = false);
    this.notify(r);
  }
  tick(onExpire = () => {
  }) {
    for (const r of this.repo.values()) {
      const t = this.now();
      if (r.emptySince !== null && t - r.emptySince >= EMPTY_TTL || r.phase === "LOBBY" && t - r.touchedAt >= LOBBY_TTL || r.phase === "REVEAL" && t - r.touchedAt >= REVEAL_TTL) {
        onExpire(r);
        this.repo.delete(r.code);
        continue;
      }
      if (r.phaseEndsAt === null || t < r.phaseEndsAt) continue;
      if (r.phase === "DRAWING") {
        r.layers.push(structuredClone(r.checkpoint));
        this.advance(r);
      } else if (r.phase === "PAUSED_RECONNECT") {
        this.advance(r);
      } else if (r.phase === "PREPARING") {
        const p = r.players.find((p2) => p2.id === r.activePlayerId);
        if (p?.socketId) this.begin(r);
        else this.advance(r);
      } else continue;
      this.notify(r);
    }
  }
};

// src/server/repository.ts
var MemoryRoomRepository = class {
  rooms = /* @__PURE__ */ new Map();
  get size() {
    return this.rooms.size;
  }
  get(code) {
    return this.rooms.get(code);
  }
  set(room) {
    this.rooms.set(room.code, room);
  }
  delete(code) {
    this.rooms.delete(code);
  }
  values() {
    return this.rooms.values();
  }
};

// src/server/socket.ts
var empty = import_zod2.z.object({}).strict();
var seatSchema = import_zod2.z.object({
  code: codeSchema,
  playerId: import_zod2.z.string().uuid(),
  token: import_zod2.z.string().regex(/^[A-Za-z0-9_-]{43}$/)
}).strict();
function attachSockets(http, origin) {
  const io = new import_socket.Server(http, {
    maxHttpBufferSize: 512e3,
    allowRequest: (req, done) => {
      const o = req.headers.origin;
      done(
        null,
        !o || (origin ? o === origin : o === `http://${req.headers.host}` || o === `https://${req.headers.host}`)
      );
    }
  });
  function publish(r) {
    io.to(r.code).emit("room:publicState", game.publicState(r));
    if (r.phase === "DRAWING" || r.phase === "REVEAL") {
      for (const p of r.players) {
        if (p.socketId && (r.phase === "REVEAL" || p.id === r.activePlayerId)) {
          try {
            io.to(p.socketId).emit(
              "canvas:authorizedSnapshot",
              game.authorized(r, p)
            );
          } catch {
          }
        }
      }
    }
  }
  const game = new Game(new MemoryRoomRepository(), void 0, publish);
  const activeConnections = /* @__PURE__ */ new Map();
  const ipLimits = /* @__PURE__ */ new Map();
  function connectionLimit(ip) {
    const t = Date.now();
    let b = ipLimits.get(ip);
    if (!b || b.reset < t) {
      b = { n: 0, reset: t + 6e4 };
      ipLimits.set(ip, b);
    }
    if (++b.n > 40)
      throw Error("Please take a moment before trying another room.");
  }
  io.on("connection", (socket) => {
    const ip = socket.handshake.address;
    if (io.engine.clientsCount > 750 || (activeConnections.get(ip) || 0) >= 25) {
      socket.disconnect(true);
      return;
    }
    activeConnections.set(ip, (activeConnections.get(ip) || 0) + 1);
    let seat;
    let bucket = 0, bucketStart = Date.now();
    let lastWrite = 0;
    const member = () => {
      if (!seat) throw Error("Please join a room first.");
      return game.member(seat.code, seat.playerId, socket.id);
    };
    const takeSeat = (next2) => {
      seat = next2;
      socket.join(next2.code);
      const { r, p } = member();
      socket.emit("room:publicState", game.publicState(r));
      if (r.phase === "REVEAL" || r.phase === "DRAWING" && r.activePlayerId === p.id && Date.now() < r.phaseEndsAt)
        socket.emit("canvas:authorizedSnapshot", game.authorized(r, p));
      return next2;
    };
    function bind(event, schema, fn) {
      const handler = (raw, ack) => {
        if (typeof ack !== "function") return;
        try {
          const t = Date.now();
          if (t - bucketStart > 1e4) {
            bucketStart = t;
            bucket = 0;
          }
          if (++bucket > 100)
            throw Error("Too many requests. Please slow down.");
          if (event === "canvas:checkpoint" || event === "turn:finish") {
            if (event === "canvas:checkpoint" && t - lastWrite < 800)
              throw Error("Please wait a moment before saving again.");
            lastWrite = t;
            if (JSON.stringify(raw).length > 48e4)
              throw Error(
                "Your drawing is too detailed to save. Undo the last mark or simplify your turn."
              );
          }
          game.tick((r) => io.to(r.code).emit("room:expired"));
          const parsed = schema.parse(raw);
          const data = fn(parsed);
          ack({ ok: true, data, serverNow: Date.now() });
        } catch (e) {
          ack({
            ok: false,
            error: e instanceof import_zod2.z.ZodError ? "Please check the details and try again." : e instanceof Error ? e.message : "Something went wrong. Please try again."
          });
        }
      };
      socket.on(event, handler);
    }
    bind("room:create", import_zod2.z.object({ name: nameSchema }).strict(), (d) => {
      if (seat) throw Error("Leave your current room first.");
      connectionLimit(socket.handshake.address);
      return takeSeat(game.create(d.name, socket.id));
    });
    bind(
      "room:join",
      import_zod2.z.object({ name: nameSchema, code: codeSchema }).strict(),
      (d) => {
        if (seat) throw Error("Leave your current room first.");
        connectionLimit(socket.handshake.address);
        return takeSeat(game.join(d.code, d.name, socket.id));
      }
    );
    bind("room:resume", seatSchema, (d) => {
      if (seat) throw Error("This connection already has a seat.");
      connectionLimit(socket.handshake.address);
      const { old } = game.resume(d, socket.id);
      if (old && old !== socket.id) {
        io.to(old).emit("room:revoked");
        io.sockets.sockets.get(old)?.disconnect(true);
      }
      return takeSeat(d);
    });
    bind("room:leave", empty, () => {
      const { r, p } = member();
      game.disconnect(r.code, p.id, socket.id, true);
      socket.leave(r.code);
      seat = void 0;
      return void 0;
    });
    bind("room:setReady", import_zod2.z.object({ ready: import_zod2.z.boolean() }).strict(), (d) => {
      const { r, p } = member();
      game.ready(r, p, d.ready);
      return void 0;
    });
    bind("room:updateSettings", settingsSchema, (d) => {
      const { r, p } = member();
      game.settings(r, p, d);
      return void 0;
    });
    bind("room:regeneratePrompt", empty, () => {
      const { r, p } = member();
      game.regenerate(r, p);
      return void 0;
    });
    bind("game:start", empty, () => {
      const { r, p } = member();
      game.start(r, p);
      return void 0;
    });
    bind("canvas:checkpoint", writeSchema, (d) => {
      const { r, p } = member();
      return game.write(r, p, d);
    });
    bind("turn:finish", writeSchema, (d) => {
      const { r, p } = member();
      game.write(r, p, d, true);
      return void 0;
    });
    bind("canvas:requestAuthorized", empty, () => {
      const { r, p } = member();
      return game.authorized(r, p);
    });
    bind("room:requestState", empty, () => game.publicState(member().r));
    bind("room:replay", empty, () => {
      const { r, p } = member();
      game.replay(r, p);
      return void 0;
    });
    socket.on("disconnect", () => {
      const count = (activeConnections.get(ip) || 1) - 1;
      if (count > 0) activeConnections.set(ip, count);
      else activeConnections.delete(ip);
      if (seat) game.disconnect(seat.code, seat.playerId, socket.id);
    });
  });
  const timer = setInterval(() => {
    game.tick((r) => io.to(r.code).emit("room:expired"));
    for (const [ip, b] of ipLimits)
      if (b.reset < Date.now()) ipLimits.delete(ip);
  }, 250);
  timer.unref();
  return {
    io,
    game,
    close: () => {
      clearInterval(timer);
      return io.close();
    }
  };
}

// server.ts
var dev = process.env.NODE_ENV !== "production";
(0, import_env.loadEnvConfig)(process.cwd(), dev);
var port = Number(process.env.PORT || 3e3);
var hostname = process.env.HOSTNAME || "0.0.0.0";
if (!dev && !process.env.APP_ORIGIN)
  throw Error("APP_ORIGIN must be configured in production.");
var app = (0, import_next.default)({ dev, hostname, port });
async function main() {
  await app.prepare();
  const handler = app.getRequestHandler();
  const http = (0, import_node_http.createServer)((req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    void handler(req, res);
  });
  const sockets = attachSockets(http, process.env.APP_ORIGIN);
  http.listen(
    port,
    hostname,
    () => console.log(`Healing Strokes ready at http://localhost:${port}`)
  );
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    setTimeout(() => process.exit(0), 3e3).unref();
    const closing = Promise.allSettled([app.close(), sockets.close()]);
    http.closeAllConnections();
    void closing.then(() => process.exit(0));
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
