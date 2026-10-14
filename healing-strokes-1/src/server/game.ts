import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import {
  nameSchema,
  codeSchema,
  settingsSchema,
  writeSchema,
  type CanvasState,
  type PublicRoomState,
  type Seat,
  type Settings,
} from "../lib/shared/model";
import { prompts } from "../lib/shared/prompts";
import type { Player, Room, RoomRepository } from "./repository";
export const PREP_MS = 10000,
  RECONNECT_MS = 30000,
  EMPTY_TTL = 30 * 60 * 1000,
  LOBBY_TTL = 2 * 60 * 60 * 1000,
  REVEAL_TTL = 60 * 60 * 1000;
const hash = (token: string) => createHash("sha256").update(token).digest();
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export class Game {
  constructor(
    readonly repo: RoomRepository,
    readonly now = () => Date.now(),
    private changed: (r: Room) => void = () => {},
  ) {}
  private notify(r: Room) {
    r.revision++;
    r.touchedAt = this.now();
    this.changed(r);
  }
  publicState(r: Room): PublicRoomState {
    return {
      code: r.code,
      hostId: r.hostId,
      players: r.players.map((p) => ({
        id: p.id,
        name: p.name,
        connected: !!p.socketId,
        ready: p.ready,
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
      serverNow: this.now(),
    };
  }
  create(name: unknown, socketId: string): Seat {
    if (this.repo.size >= 100)
      throw Error("The studio is full. Please try again later.");
    let code = "";
    do {
      code = Array.from(
        { length: 8 },
        () => alphabet[randomInt(alphabet.length)],
      ).join("");
    } while (this.repo.get(code));
    const { player, token } = this.player(name, socketId);
    const r: Room = {
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
      emptySince: null,
    };
    this.repo.set(r);
    this.notify(r);
    return { code, playerId: player.id, token };
  }
  private player(name: unknown, socketId: string) {
    const token = randomBytes(32).toString("base64url");
    return {
      token,
      player: {
        id: randomUUID(),
        name: nameSchema.parse(name),
        tokenHash: hash(token),
        socketId,
        ready: false,
      } as Player,
    };
  }
  room(code: unknown) {
    const r = this.repo.get(codeSchema.parse(code));
    if (!r)
      throw Error("This room no longer exists. You can create a fresh one.");
    return r;
  }
  join(code: unknown, name: unknown, socketId: string): Seat {
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
  resume(seat: Seat, socketId: string) {
    const r = this.room(seat.code);
    const p = r.players.find((p) => p.id === seat.playerId);
    const digest = hash(seat.token);
    if (!p || !timingSafeEqual(p.tokenHash, digest))
      throw Error("This seat could not be restored.");
    const old = p.socketId;
    p.socketId = socketId;
    r.emptySince = null;
    if (r.phase === "PAUSED_RECONNECT" && r.activePlayerId === p.id) {
      if (this.now() >= r.phaseEndsAt!) {
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
  member(code: string, playerId: string, socketId: string) {
    const r = this.room(code),
      p = r.players.find((p) => p.id === playerId);
    if (!p || p.socketId !== socketId)
      throw Error("Your connection no longer owns this seat.");
    return { r, p };
  }
  host(r: Room, p: Player) {
    if (r.hostId !== p.id) throw Error("Only the host can do that.");
  }
  lobby(r: Room) {
    if (r.phase !== "LOBBY")
      throw Error("This action is available before the session starts.");
  }
  ready(r: Room, p: Player, value: boolean) {
    this.lobby(r);
    p.ready = value;
    this.notify(r);
  }
  settings(r: Room, p: Player, input: Settings) {
    this.host(r, p);
    this.lobby(r);
    r.settings = settingsSchema.parse(input);
    this.notify(r);
  }
  private prompt() {
    return prompts[randomInt(prompts.length)];
  }
  regenerate(r: Room, p: Player) {
    this.host(r, p);
    this.lobby(r);
    let next = this.prompt();
    while (next === r.prompt) next = this.prompt();
    r.prompt = next;
    this.notify(r);
  }
  start(r: Room, p: Player) {
    this.host(r, p);
    this.lobby(r);
    const present = r.players.filter((p) => p.socketId);
    if (present.length < 2 || present.some((p) => !p.ready))
      throw Error(
        "At least two connected guests are needed, and everyone connected must be ready.",
      );
    r.order = present.map((p) => p.id);
    for (let i = r.order.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [r.order[i], r.order[j]] = [r.order[j], r.order[i]];
    }
    r.slot = 0;
    this.begin(r);
    this.notify(r);
  }
  private begin(r: Room) {
    r.phase = "DRAWING";
    r.activePlayerId = r.order[r.slot % r.order.length];
    r.turnId = randomUUID();
    r.checkpoint = [];
    r.sequence = -1;
    r.phaseStartedAt = this.now();
    r.phaseEndsAt = this.now() + r.settings.minutes * 60000;
  }
  private advance(r: Room) {
    r.checkpoint = [];
    r.sequence = -1;
    r.turnId = null;
    r.slot++;
    while (
      r.slot < r.order.length * r.settings.rounds &&
      !r.players.find((p) => p.id === r.order[r.slot % r.order.length])
        ?.socketId
    )
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
  authorized(r: Room, p: Player): CanvasState {
    if (!r.players.includes(p)) throw Error("Room membership is required.");
    if (
      r.phase !== "REVEAL" &&
      !(
        r.phase === "DRAWING" &&
        r.activePlayerId === p.id &&
        this.now() < r.phaseEndsAt!
      )
    )
      throw Error(
        "The artwork is resting until your turn or the final reveal.",
      );
    return {
      code: r.code,
      turnId: r.turnId,
      layers: structuredClone(r.layers),
      overlay: r.phase === "REVEAL" ? [] : structuredClone(r.checkpoint),
      sequence: r.sequence,
      revision: r.revision,
    };
  }
  write(r: Room, p: Player, input: unknown, finish = false) {
    const data = writeSchema.parse(input);
    if (
      r.phase !== "DRAWING" ||
      r.activePlayerId !== p.id ||
      r.turnId !== data.turnId ||
      this.now() >= r.phaseEndsAt!
    )
      throw Error("This drawing turn has ended or is not yours.");
    const points = (overlays: typeof r.layers) =>
      overlays.reduce(
        (total, layer) =>
          total + layer.reduce((n, m) => n + m.points.length, 0),
        0,
      );
    if (points([...r.layers, data.overlay]) > 200000)
      throw Error(
        "This shared canvas has reached its detail limit. Please simplify your current turn.",
      );
    let total = points([data.overlay]);
    for (const other of this.repo.values())
      total +=
        points(other.layers) + (other === r ? 0 : points([other.checkpoint]));
    if (total > 2000000)
      throw Error(
        "The studio is at capacity. Please try saving again in a moment.",
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
  disconnect(code: string, id: string, socketId: string, leave = false) {
    const r = this.repo.get(code),
      p = r?.players.find((p) => p.id === id);
    if (!r || !p || p.socketId !== socketId) return;
    p.socketId = null;
    p.ready = false;
    if (r.phase === "DRAWING" && r.activePlayerId === id) {
      r.remaining = Math.max(0, r.phaseEndsAt! - this.now());
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
        const next = r.players.find((x) => x.socketId);
        if (next) r.hostId = next.id;
      }
    }
    if (!r.players.some((p) => p.socketId)) r.emptySince ??= this.now();
    this.notify(r);
  }
  replay(r: Room, p: Player) {
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
    r.players.forEach((p) => (p.ready = false));
    this.notify(r);
  }
  tick(onExpire: (r: Room) => void = () => {}) {
    for (const r of this.repo.values()) {
      const t = this.now();
      if (
        (r.emptySince !== null && t - r.emptySince >= EMPTY_TTL) ||
        (r.phase === "LOBBY" && t - r.touchedAt >= LOBBY_TTL) ||
        (r.phase === "REVEAL" && t - r.touchedAt >= REVEAL_TTL)
      ) {
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
        const p = r.players.find((p) => p.id === r.activePlayerId);
        if (p?.socketId) this.begin(r);
        else this.advance(r);
      } else continue;
      this.notify(r);
    }
  }
}
