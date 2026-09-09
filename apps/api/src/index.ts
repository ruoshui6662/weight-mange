import { createServer, type Server, type ServerResponse } from "node:http";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

import { applyMigrations, openDatabase } from "@nutrition-tracker/db";
import { CORE_MIGRATIONS } from "@nutrition-tracker/db/schema";

export type ApiOptions = {
  dbPath: string;
  port?: number;
};

export type ApiRuntime = {
  server: Server;
  port: number;
  close(): Promise<void>;
};

function writeJson(response: ServerResponse, statusCode: number, body: object) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function writeHome(response: ServerResponse) {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>体重管理服务</title>
    <style>
      body { margin: 0; padding: 3rem 1.5rem; color: #24313a; background: #f5f7f8; font-family: system-ui, sans-serif; }
      main { max-width: 38rem; margin: 0 auto; padding: 2rem; background: white; border-radius: 1rem; box-shadow: 0 0.5rem 2rem rgb(36 49 58 / 10%); }
      h1 { margin-top: 0; font-size: 1.6rem; }
      a { color: #176b87; }
    </style>
  </head>
  <body>
    <main>
      <h1>体重管理服务已启动</h1>
      <p>API 容器运行正常。业务界面将在后续版本提供。</p>
      <p><a href="/healthz">健康检查</a> · <a href="/readyz">就绪检查</a></p>
    </main>
  </body>
</html>`);
}

export async function startApiServer(options: ApiOptions): Promise<ApiRuntime> {
  mkdirSync(dirname(options.dbPath), { recursive: true });
  const { sqlite } = openDatabase(options.dbPath);
  let ready = false;

  try {
    applyMigrations(sqlite, CORE_MIGRATIONS);
    const server = createServer((request, response) => {
      if (request.method === "GET" && request.url === "/") {
        writeHome(response);
        return;
      }
      if (request.method === "GET" && request.url === "/healthz") {
        writeJson(response, 200, { status: "ok" });
        return;
      }
      if (request.method === "GET" && request.url === "/readyz") {
        writeJson(response, ready ? 200 : 503, { status: ready ? "ready" : "starting" });
        return;
      }
      writeJson(response, 404, { error: "NOT_FOUND" });
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(options.port ?? Number(process.env.PORT ?? 3000), "0.0.0.0", () => resolve());
    });
    ready = true;
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : options.port ?? 3000;
    return {
      server,
      port,
      async close() {
        ready = false;
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error === undefined ? resolve() : reject(error)));
        });
        sqlite.close();
      },
    };
  } catch (error) {
    sqlite.close();
    throw error;
  }
}

async function main() {
  const runtime = await startApiServer({
    dbPath: process.env.DB_PATH ?? "/data/db/app.sqlite",
  });
  console.log(JSON.stringify({ event: "api_started", port: runtime.port }));
  const shutdown = () => {
    void runtime.close().then(() => process.exit(0));
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
