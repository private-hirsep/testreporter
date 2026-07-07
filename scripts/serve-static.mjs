import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "dist/example-report");
const port = Number(process.argv[3] ?? 4173);

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"]
]);

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const decoded = decodeURIComponent(url.pathname);
  const candidate = path.normalize(path.join(root, decoded));
  if (!candidate.startsWith(root)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  let file = candidate;
  if (!existsSync(file) || (await stat(file)).isDirectory()) file = path.join(root, "index.html");
  if (!existsSync(file)) {
    response.writeHead(404).end("Not found");
    return;
  }
  response.writeHead(200, { "content-type": contentTypes.get(path.extname(file)) ?? "application/octet-stream" });
  createReadStream(file).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`Serving ${root} on http://127.0.0.1:${port}`);
});
