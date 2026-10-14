import { createServer } from "node:http";
import { afterEach, beforeEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { attachSockets } from "../src/server/socket";
import type {
  Ack,
  CanvasState,
  PublicRoomState,
} from "../src/lib/shared/model";
let server: ReturnType<typeof attachSockets>, url: string;
const clients: Socket[] = [];
beforeEach(async () => {
  const http = createServer();
  server = attachSockets(http);
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  const address = http.address();
  if (!address || typeof address === "string") throw Error("No port");
  url = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  clients.forEach((c) => c.disconnect());
  clients.length = 0;
  await server.close();
});
async function client() {
  const s = io(url, { transports: ["websocket"], forceNew: true });
  clients.push(s);
  await new Promise<void>((res, rej) => {
    s.once("connect", res);
    s.once("connect_error", rej);
  });
  return s;
}
async function call<T = undefined>(
  s: Socket,
  event: string,
  payload: unknown,
): Promise<T> {
  return new Promise((resolve, reject) => {
    s.timeout(3000).emit(event, payload, (e: Error | null, a: Ack<T>) => {
      if (e) reject(e);
      else if (!a.ok) reject(Error(a.error));
      else resolve(a.data);
    });
  });
}
it("enforces privacy over actual independent socket connections, including forged cross-room access", async () => {
  const [a, b, outsider] = await Promise.all([client(), client(), client()]);
  const seat = await call<{ code: string; playerId: string; token: string }>(
    a,
    "room:create",
    { name: "Alex" },
  );
  await call(b, "room:join", { name: "Blake", code: seat.code });
  await call(outsider, "room:create", { name: "Casey" });
  const shots: { a: CanvasState[]; b: CanvasState[]; other: CanvasState[] } = {
    a: [],
    b: [],
    other: [],
  };
  const publicStates: PublicRoomState[] = [];
  a.on("canvas:authorizedSnapshot", (d) => shots.a.push(d));
  b.on("canvas:authorizedSnapshot", (d) => shots.b.push(d));
  outsider.on("canvas:authorizedSnapshot", (d) => shots.other.push(d));
  b.on("room:publicState", (d) => publicStates.push(d));
  await call(a, "room:setReady", { ready: true });
  await call(b, "room:setReady", { ready: true });
  await call(a, "game:start", {});
  const state = await call<PublicRoomState>(a, "room:requestState", {});
  const artist = state.activePlayerId === seat.playerId ? a : b,
    waiter = artist === a ? b : a;
  expect(shots.a.length + shots.b.length).toBe(1);
  expect(shots.other).toEqual([]);
  await expect(call(waiter, "canvas:requestAuthorized", {})).rejects.toThrow(
    "artwork",
  );
  await expect(call(outsider, "canvas:requestAuthorized", {})).rejects.toThrow(
    "artwork",
  );
  const overlay = [
    { type: "brush", points: [10, 10, 100, 100], color: "#123456", width: 10 },
  ];
  await expect(
    call(waiter, "canvas:checkpoint", {
      turnId: state.turnId,
      sequence: 0,
      overlay,
    }),
  ).rejects.toThrow("not yours");
  await expect(
    call(outsider, "canvas:requestAuthorized", { code: seat.code }),
  ).rejects.toThrow("check");
  await call(artist, "canvas:checkpoint", {
    turnId: state.turnId,
    sequence: 0,
    overlay,
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(shots.other).toEqual([]);
  expect(artist === a ? shots.b : shots.a).toEqual([]);
  expect(JSON.stringify(publicStates)).not.toContain("#123456");
  await call(artist, "turn:finish", {
    turnId: state.turnId,
    sequence: 1,
    overlay,
  });
  await expect(call(waiter, "canvas:requestAuthorized", {})).rejects.toThrow(
    "artwork",
  );
  const r = server.game.room(seat.code);
  r.phaseEndsAt = Date.now() - 1;
  server.game.tick();
  const next = await call<PublicRoomState>(waiter, "room:requestState", {});
  expect(next.phase).toBe("DRAWING");
  const canvas = await call<CanvasState>(
    waiter,
    "canvas:requestAuthorized",
    {},
  );
  expect(canvas.layers).toEqual([overlay]);
  await call(waiter, "turn:finish", {
    turnId: next.turnId,
    sequence: 0,
    overlay: [],
  });
  const finalA = await call<CanvasState>(a, "canvas:requestAuthorized", {}),
    finalB = await call<CanvasState>(b, "canvas:requestAuthorized", {});
  expect(finalA.layers).toEqual(finalB.layers);
  expect(finalA.layers[0]).toEqual(overlay);
  await expect(
    call(outsider, "canvas:requestAuthorized", {}),
  ).rejects.toThrow();
  expect(shots.other).toEqual([]);
});
it("restores a paused artist checkpoint and revokes duplicate sockets", async () => {
  const a = await client(),
    b = await client();
  const first = await call<{ code: string; playerId: string; token: string }>(
    a,
    "room:create",
    { name: "Alex" },
  );
  const second = await call<{ code: string; playerId: string; token: string }>(
    b,
    "room:join",
    { code: first.code, name: "Blake" },
  );
  await call(a, "room:setReady", { ready: true });
  await call(b, "room:setReady", { ready: true });
  await call(a, "game:start", {});
  const state = await call<PublicRoomState>(a, "room:requestState", {});
  const artist = state.activePlayerId === first.playerId ? a : b,
    seat = artist === a ? first : second;
  const overlay = [
    { type: "rect", points: [0, 0, 30, 30], color: "#abcdef", width: 2 },
  ];
  await call(artist, "canvas:checkpoint", {
    turnId: state.turnId,
    sequence: 0,
    overlay,
  });
  artist.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(server.game.room(first.code).phase).toBe("PAUSED_RECONNECT");
  const replacement = await client();
  await call(replacement, "room:resume", seat);
  expect(server.game.room(first.code).phase).toBe("DRAWING");
  expect(
    (await call<CanvasState>(replacement, "canvas:requestAuthorized", {}))
      .overlay,
  ).toEqual(overlay);
  const latest = await client();
  const revoked = new Promise<void>((resolve) =>
    replacement.once("room:revoked", resolve),
  );
  await call(latest, "room:resume", seat);
  await revoked;
  expect(replacement.connected).toBe(false);
  await expect(
    call(latest, "canvas:checkpoint", { turnId: "bad", sequence: 1, overlay }),
  ).rejects.toThrow();
});
