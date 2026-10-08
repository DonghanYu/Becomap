// out-static/을 GitHub Pages처럼 /Becomap/ 하위 경로로 서빙합니다(로컬 확인·E2E 전용).
// 폴더 요청은 index.html, 없는 파일은 404.html을 돌려줍니다.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "out-static");
const base = process.env.BASE_PATH ?? "/Becomap";
const port = Number(process.env.PORT ?? 4300);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".txt": "text/plain; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  if (!url.pathname.startsWith(base)) {
    res.writeHead(404).end("not found");
    return;
  }
  let rel = decodeURIComponent(url.pathname.slice(base.length)) || "/";
  let file = path.join(root, rel);
  if (!file.startsWith(root)) return void res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!rel.endsWith("/")) {
      res.writeHead(301, { Location: `${base}${rel}/${url.search}` }).end();
      return;
    }
    file = path.join(file, "index.html");
  }
  let status = 200;
  if (!existsSync(file)) {
    status = 404;
    file = path.join(root, "404.html");
  }
  res.writeHead(status, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`http://localhost:${port}${base}/`));
