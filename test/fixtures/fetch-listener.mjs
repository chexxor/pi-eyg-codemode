#!/usr/bin/env node
// A local listener for the `fetch` probes: it records one line per request so a probe can see
// whether bytes left the guarded process, and replies `heard`. It is a probe fixture, not part of
// what the package runs.
//
//   node test/fixtures/fetch-listener.mjs <log-path> [port]   # default port 8077
//
// It exits non-zero when the port is taken, so a probe that cannot listen fails loudly instead of
// reading someone else's listener as its own.
import { appendFileSync } from "node:fs";
import { createServer } from "node:http";

const log = process.argv[2];
const port = Number(process.argv[3] ?? 8077);

const server = createServer((request, response) => {
  const parts = [];
  request.on("data", (part) => parts.push(part));
  request.on("end", () => {
    appendFileSync(
      log,
      `${request.method} ${request.url} body=${Buffer.concat(parts).toString("utf8")} ` +
        Object.entries(request.headers).map(([name, value]) => `${name}=${value}`).join(" ") +
        "\n",
    );
    response.end("heard");
  });
});

server.on("error", (error) => {
  console.log(`LISTENER ERROR ${error.code}`);
  process.exit(1);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`LISTENING ${server.address().port}`);
});
