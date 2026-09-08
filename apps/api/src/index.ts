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

export async function startApiServer(options: ApiOptions): Promise<ApiRuntime> {
  mkdirSync(dirname(options.dbPath), { recursive: true });
  const { sqlite } = openDatabase(options.dbPath);
  let ready = false;

  try {
    applyMigrations(sqlite, CORE_MIGRATIONS);
    const server = createServer((request, response) => {
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
