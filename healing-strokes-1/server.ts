import { createServer } from "node:http";
import next from "next";
import { loadEnvConfig } from "@next/env";
import { attachSockets } from "./src/server/socket";
const dev = process.env.NODE_ENV !== "production";
loadEnvConfig(process.cwd(), dev);
const port = Number(process.env.PORT || 3000),
  hostname = process.env.HOSTNAME || "0.0.0.0";
if (!dev && !process.env.APP_ORIGIN)
  throw Error("APP_ORIGIN must be configured in production.");
const app = next({ dev, hostname, port });
async function main() {
  await app.prepare();
  const handler = app.getRequestHandler();
  const http = createServer((req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    void handler(req, res);
  });
  const sockets = attachSockets(http, process.env.APP_ORIGIN);
  http.listen(port, hostname, () =>
    console.log(`Healing Strokes ready at http://localhost:${port}`),
  );
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    // Close Next's development/HMR resources as well as application sockets.
    // Bound shutdown even if an upgraded connection does not cooperate.
    setTimeout(() => process.exit(0), 3000).unref();
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
