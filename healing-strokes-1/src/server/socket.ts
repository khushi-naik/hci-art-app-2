import { Server, type Socket } from "socket.io";
import { z } from "zod";
import { Game } from "./game";
import { MemoryRoomRepository } from "./repository";
import type { Room } from "./repository";
import {
  nameSchema,
  codeSchema,
  settingsSchema,
  writeSchema,
  type ClientEvents,
  type ServerEvents,
  type Requests,
  type Responses,
  type Ack,
  type Seat,
} from "../lib/shared/model";
import type { Server as HttpServer } from "node:http";
const empty = z.object({}).strict();
const seatSchema = z
  .object({
    code: codeSchema,
    playerId: z.string().uuid(),
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  })
  .strict();
export function attachSockets(http: HttpServer, origin?: string) {
  const io = new Server<ClientEvents, ServerEvents>(http, {
    maxHttpBufferSize: 512000,
    allowRequest: (req, done) => {
      const o = req.headers.origin;
      done(
        null,
        !o ||
          (origin
            ? o === origin
            : o === `http://${req.headers.host}` ||
              o === `https://${req.headers.host}`),
      );
    },
  });
  function publish(r: Room) {
    io.to(r.code).emit("room:publicState", game.publicState(r));
    if (r.phase === "DRAWING" || r.phase === "REVEAL") {
      for (const p of r.players) {
        if (p.socketId && (r.phase === "REVEAL" || p.id === r.activePlayerId)) {
          try {
            io.to(p.socketId).emit(
              "canvas:authorizedSnapshot",
              game.authorized(r, p),
            );
          } catch {
            /* The tick will advance an expired drawing phase. */
          }
        }
      }
    }
  }
  const game = new Game(new MemoryRoomRepository(), undefined, publish);
  const activeConnections = new Map<string, number>();
  const ipLimits = new Map<string, { n: number; reset: number }>();
  function connectionLimit(ip: string) {
    const t = Date.now();
    let b = ipLimits.get(ip);
    if (!b || b.reset < t) {
      b = { n: 0, reset: t + 60000 };
      ipLimits.set(ip, b);
    }
    if (++b.n > 40)
      throw Error("Please take a moment before trying another room.");
  }
  io.on("connection", (socket: Socket<ClientEvents, ServerEvents>) => {
    const ip = socket.handshake.address;
    if (
      io.engine.clientsCount > 750 ||
      (activeConnections.get(ip) || 0) >= 25
    ) {
      socket.disconnect(true);
      return;
    }
    activeConnections.set(ip, (activeConnections.get(ip) || 0) + 1);
    let seat: Seat | undefined;
    let bucket = 0,
      bucketStart = Date.now();
    let lastWrite = 0;
    const member = () => {
      if (!seat) throw Error("Please join a room first.");
      return game.member(seat.code, seat.playerId, socket.id);
    };
    const takeSeat = (next: Seat) => {
      seat = next;
      socket.join(next.code);
      const { r, p } = member();
      socket.emit("room:publicState", game.publicState(r));
      if (
        r.phase === "REVEAL" ||
        (r.phase === "DRAWING" &&
          r.activePlayerId === p.id &&
          Date.now() < r.phaseEndsAt!)
      )
        socket.emit("canvas:authorizedSnapshot", game.authorized(r, p));
      return next;
    };
    function bind<K extends keyof Requests>(
      event: K,
      schema: z.ZodType<Requests[K]>,
      fn: (data: Requests[K]) => Responses[K],
    ) {
      const handler = (raw: unknown, ack: (a: Ack<Responses[K]>) => void) => {
        if (typeof ack !== "function") return;
        try {
          const t = Date.now();
          if (t - bucketStart > 10000) {
            bucketStart = t;
            bucket = 0;
          }
          if (++bucket > 100)
            throw Error("Too many requests. Please slow down.");
          if (event === "canvas:checkpoint" || event === "turn:finish") {
            if (event === "canvas:checkpoint" && t - lastWrite < 800)
              throw Error("Please wait a moment before saving again.");
            lastWrite = t;
            if (JSON.stringify(raw).length > 480000)
              throw Error(
                "Your drawing is too detailed to save. Undo the last mark or simplify your turn.",
              );
          }
          // Flush due server transitions before authorizing any operation.
          game.tick((r) => io.to(r.code).emit("room:expired"));
          const parsed = schema.parse(raw);
          const data = fn(parsed);
          ack({ ok: true, data, serverNow: Date.now() });
        } catch (e) {
          ack({
            ok: false,
            error:
              e instanceof z.ZodError
                ? "Please check the details and try again."
                : e instanceof Error
                  ? e.message
                  : "Something went wrong. Please try again.",
          });
        }
      };
      socket.on(event, handler as never);
    }
    bind("room:create", z.object({ name: nameSchema }).strict(), (d) => {
      if (seat) throw Error("Leave your current room first.");
      connectionLimit(socket.handshake.address);
      return takeSeat(game.create(d.name, socket.id));
    });
    bind(
      "room:join",
      z.object({ name: nameSchema, code: codeSchema }).strict(),
      (d) => {
        if (seat) throw Error("Leave your current room first.");
        connectionLimit(socket.handshake.address);
        return takeSeat(game.join(d.code, d.name, socket.id));
      },
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
      seat = undefined;
      return undefined;
    });
    bind("room:setReady", z.object({ ready: z.boolean() }).strict(), (d) => {
      const { r, p } = member();
      game.ready(r, p, d.ready);
      return undefined;
    });
    bind("room:updateSettings", settingsSchema, (d) => {
      const { r, p } = member();
      game.settings(r, p, d);
      return undefined;
    });
    bind("room:regeneratePrompt", empty, () => {
      const { r, p } = member();
      game.regenerate(r, p);
      return undefined;
    });
    bind("game:start", empty, () => {
      const { r, p } = member();
      game.start(r, p);
      return undefined;
    });
    bind("canvas:checkpoint", writeSchema, (d) => {
      const { r, p } = member();
      return game.write(r, p, d);
    });
    bind("turn:finish", writeSchema, (d) => {
      const { r, p } = member();
      game.write(r, p, d, true);
      return undefined;
    });
    bind("canvas:requestAuthorized", empty, () => {
      const { r, p } = member();
      return game.authorized(r, p);
    });
    bind("room:requestState", empty, () => game.publicState(member().r));
    bind("room:replay", empty, () => {
      const { r, p } = member();
      game.replay(r, p);
      return undefined;
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
    },
  };
}
