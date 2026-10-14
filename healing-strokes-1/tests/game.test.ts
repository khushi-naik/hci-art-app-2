import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Game,
  PREP_MS,
  RECONNECT_MS,
  EMPTY_TTL,
  REVEAL_TTL,
} from "../src/server/game";
import { MemoryRoomRepository } from "../src/server/repository";
import { overlaySchema, type Overlay } from "../src/lib/shared/model";
const ink: Overlay = [
  { type: "brush", points: [20, 30, 40, 50], color: "#abcdef", width: 4 },
];
let game: Game;
beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "Date",
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
    ],
  });
  vi.setSystemTime(1000);
  game = new Game(new MemoryRoomRepository());
});
afterEach(() => vi.useRealTimers());
function setup(count = 2) {
  const a = game.create("Alex", "s1");
  const seats = [a];
  for (let i = 1; i < count; i++)
    seats.push(game.join(a.code, `Guest ${i}`, `s${i + 1}`));
  const r = game.room(a.code);
  return { r, seats };
}
function readyStart() {
  const { r, seats } = setup();
  r.players.forEach((p) => game.ready(r, p, true));
  game.start(r, r.players[0]);
  return {
    r,
    seats,
    artist: r.players.find((p) => p.id === r.activePlayerId)!,
  };
}
describe("lobby and identity", () => {
  it("allows 2–5 seats and rejects a sixth", () => {
    const { r } = setup(5);
    expect(r.players).toHaveLength(5);
    expect(() => game.join(r.code, "Sixth", "s6")).toThrow("five");
  });
  it("requires two connected all-ready guests", () => {
    const { r } = setup();
    expect(() => game.start(r, r.players[0])).toThrow("ready");
    game.ready(r, r.players[0], true);
    expect(() => game.start(r, r.players[0])).toThrow();
    game.ready(r, r.players[1], true);
    game.disconnect(r.code, r.players[1].id, "s2");
    expect(() => game.start(r, r.players[0])).toThrow();
  });
  it("validates host-only settings and durations", () => {
    const { r } = setup();
    expect(() =>
      game.settings(r, r.players[1], { rounds: 1, minutes: 2 }),
    ).toThrow("host");
    for (const minutes of [2, 3, 4, 5] as const) {
      game.settings(r, r.players[0], { rounds: 3, minutes });
      expect(r.settings.minutes).toBe(minutes);
    }
    expect(() =>
      game.settings(r, r.players[0], { rounds: 4, minutes: 2 }),
    ).toThrow();
    expect(() =>
      game.settings(r, r.players[0], { rounds: 1, minutes: 1 as 2 }),
    ).toThrow();
  });
  it("scopes tokens to room/player and revokes earlier connection", () => {
    const { r, seats } = setup();
    const b = game.create("Blake", "b");
    expect(() =>
      game.resume({ ...seats[0], token: b.token }, "fake"),
    ).toThrow();
    expect(() => game.resume({ ...seats[0], code: b.code }, "fake")).toThrow();
    const result = game.resume(seats[0], "new");
    expect(result.old).toBe("s1");
    expect(() => game.member(r.code, seats[0].playerId, "s1")).toThrow();
    expect(game.member(r.code, seats[0].playerId, "new").p.id).toBe(
      seats[0].playerId,
    );
  });
  it("uses neutral bounded names, secure tokens and public DTOs", () => {
    expect(() => game.create("x", "s")).toThrow();
    expect(() => game.create("ab\ncd", "s")).toThrow();
    const { r, seats } = setup();
    expect(seats[0].token).toHaveLength(43);
    expect(JSON.stringify(game.publicState(r))).not.toMatch(
      /"(token|checkpoint|layers|overlay)":/,
    );
  });
});
describe("authoritative turns and privacy", () => {
  it("only sends authorized artwork to artist and reveal members", () => {
    const { r, artist } = readyStart();
    const waiter = r.players.find((p) => p !== artist)!;
    expect(() => game.authorized(r, waiter)).toThrow();
    expect(game.authorized(r, artist).layers).toEqual([]);
    game.write(r, artist, { turnId: r.turnId, sequence: 0, overlay: ink });
    expect(() =>
      game.write(r, waiter, { turnId: r.turnId, sequence: 1, overlay: ink }),
    ).toThrow();
    expect(JSON.stringify(game.publicState(r))).not.toContain("#abcdef");
  });
  it("commits the checkpoint at exact timeout, hides preparation, and starts after exactly 10 seconds", () => {
    const { r, artist } = readyStart();
    game.write(r, artist, { turnId: r.turnId, sequence: 0, overlay: ink });
    vi.advanceTimersByTime(239999);
    game.tick();
    expect(r.phase).toBe("DRAWING");
    vi.advanceTimersByTime(1);
    game.tick();
    expect(r.phase).toBe("PREPARING");
    expect(r.layers).toEqual([ink]);
    r.players.forEach((p) => expect(() => game.authorized(r, p)).toThrow());
    vi.advanceTimersByTime(PREP_MS - 1);
    game.tick();
    expect(r.phase).toBe("PREPARING");
    vi.advanceTimersByTime(1);
    game.tick();
    expect(r.phase).toBe("DRAWING");
    const next = r.players.find((p) => p.id === r.activePlayerId)!;
    expect(game.authorized(r, next).layers).toEqual([ink]);
  });
  it("rejects late, stale, forged and repeated writes", () => {
    const { r, artist } = readyStart();
    const input = { turnId: r.turnId, sequence: 0, overlay: ink };
    expect(() =>
      game.write(r, artist, { ...input, turnId: "forged" }),
    ).toThrow();
    game.write(r, artist, input);
    expect(() => game.write(r, artist, input)).toThrow("older");
    vi.advanceTimersByTime(240000);
    expect(() => game.write(r, artist, { ...input, sequence: 1 })).toThrow(
      "ended",
    );
  });
  it("preserves turn order across all three rounds and reveals exactly once", () => {
    const { r } = setup(3);
    game.settings(r, r.players[0], { rounds: 3, minutes: 2 });
    r.players.forEach((p) => game.ready(r, p, true));
    game.start(r, r.players[0]);
    const order = [...r.order];
    const seen = [];
    for (let i = 0; i < 9; i++) {
      const artist = r.players.find((p) => p.id === r.activePlayerId)!;
      seen.push(artist.id);
      game.write(
        r,
        artist,
        { turnId: r.turnId, sequence: 0, overlay: ink },
        true,
      );
      if (i < 8) {
        vi.advanceTimersByTime(PREP_MS);
        game.tick();
      }
    }
    expect(seen).toEqual([...order, ...order, ...order]);
    expect(r.phase).toBe("REVEAL");
    expect(r.layers).toHaveLength(9);
    r.players.forEach((p) =>
      expect(game.authorized(r, p).layers).toHaveLength(9),
    );
    game.tick();
    expect(r.layers).toHaveLength(9);
  });
  it("locks earlier contributions even when current overlay is cleared or erased", () => {
    const { r, artist } = readyStart();
    game.write(
      r,
      artist,
      { turnId: r.turnId, sequence: 0, overlay: ink },
      true,
    );
    vi.advanceTimersByTime(PREP_MS);
    game.tick();
    const next = r.players.find((p) => p.id === r.activePlayerId)!;
    game.write(r, next, { turnId: r.turnId, sequence: 0, overlay: [] }, true);
    expect(r.layers[0]).toEqual(ink);
    expect(r.layers[1]).toEqual([]);
  });
  it("forbids new seats after start and allows clean replay", () => {
    const { r, artist } = readyStart();
    expect(() => game.join(r.code, "Late guest", "late")).toThrow("begun");
    game.write(r, artist, { turnId: r.turnId, sequence: 0, overlay: [] }, true);
    vi.advanceTimersByTime(PREP_MS);
    game.tick();
    game.write(
      r,
      r.players.find((p) => p.id === r.activePlayerId)!,
      { turnId: r.turnId, sequence: 0, overlay: [] },
      true,
    );
    game.replay(r, r.players[0]);
    expect(r.phase).toBe("LOBBY");
    expect(r.layers).toEqual([]);
    expect(r.players.every((p) => !p.ready)).toBe(true);
  });
});
describe("reconnects, skipping and cleanup", () => {
  it("pauses, restores checkpoint and remaining drawing time", () => {
    const { r, seats, artist } = readyStart();
    game.write(r, artist, { turnId: r.turnId, sequence: 0, overlay: ink });
    vi.advanceTimersByTime(20000);
    game.disconnect(r.code, artist.id, artist.socketId!);
    expect(r.phase).toBe("PAUSED_RECONNECT");
    expect(() => game.authorized(r, artist)).toThrow();
    vi.advanceTimersByTime(10000);
    game.resume(
      seats.find((s) => s.playerId === artist.id)!,
      "reconnected",
    );
    expect(r.phase).toBe("DRAWING");
    expect(r.phaseEndsAt! - Date.now()).toBe(220000);
    expect(game.authorized(r, artist).overlay).toEqual(ink);
  });
  it("skips absent artist at 30 seconds and discards checkpoint", () => {
    const { r, artist } = readyStart();
    game.write(r, artist, { turnId: r.turnId, sequence: 0, overlay: ink });
    game.disconnect(r.code, artist.id, artist.socketId!);
    vi.advanceTimersByTime(RECONNECT_MS - 1);
    game.tick();
    expect(r.phase).toBe("PAUSED_RECONNECT");
    vi.advanceTimersByTime(1);
    game.tick();
    expect(r.phase).toBe("PREPARING");
    expect(r.layers).toEqual([]);
  });
  it("skips waiting disconnected guests without stalling", () => {
    const { r, artist } = readyStart();
    const waiter = r.players.find((p) => p !== artist)!;
    game.disconnect(r.code, waiter.id, waiter.socketId!);
    game.write(
      r,
      artist,
      { turnId: r.turnId, sequence: 0, overlay: ink },
      true,
    );
    expect(r.phase).toBe("REVEAL");
  });
  it("ignores disconnects from a superseded socket", () => {
    const { r, seats } = setup();
    game.resume(seats[0], "replacement");
    game.disconnect(r.code, seats[0].playerId, "s1");
    expect(r.players[0].socketId).toBe("replacement");
  });
  it("expires empty and completed rooms", () => {
    const { r, seats } = setup();
    for (let i = 0; i < seats.length; i++)
      game.disconnect(r.code, seats[i].playerId, `s${i + 1}`);
    vi.advanceTimersByTime(EMPTY_TTL);
    game.tick();
    expect(game.repo.get(r.code)).toBeUndefined();
    const x = readyStart();
    game.write(
      x.r,
      x.artist,
      { turnId: x.r.turnId, sequence: 0, overlay: [] },
      true,
    );
    vi.advanceTimersByTime(PREP_MS);
    game.tick();
    game.write(
      x.r,
      x.r.players.find((p) => p.id === x.r.activePlayerId)!,
      { turnId: x.r.turnId, sequence: 0, overlay: [] },
      true,
    );
    vi.advanceTimersByTime(REVEAL_TTL);
    game.tick();
    expect(game.repo.get(x.r.code)).toBeUndefined();
  });
});
describe("constrained drawing data", () => {
  it("rejects arbitrary objects, URLs, coordinates and complexity", () => {
    expect(
      overlaySchema.safeParse([{ ...ink[0], url: "https://evil" }]).success,
    ).toBe(false);
    expect(
      overlaySchema.safeParse([{ ...ink[0], type: "image" }]).success,
    ).toBe(false);
    expect(
      overlaySchema.safeParse([{ ...ink[0], points: [0, 900, 0, 0] }]).success,
    ).toBe(false);
    expect(
      overlaySchema.safeParse([{ ...ink[0], color: "url(x)" }]).success,
    ).toBe(false);
    expect(overlaySchema.safeParse(Array(401).fill(ink[0])).success).toBe(
      false,
    );
    expect(
      overlaySchema.safeParse([{ ...ink[0], width: Infinity }]).success,
    ).toBe(false);
  });
});
