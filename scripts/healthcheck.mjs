const port = Number(process.env.PORT ?? 3000);
const response = await globalThis.fetch(`http://127.0.0.1:${port}/healthz`);
if (!response.ok) {
  process.exitCode = 1;
}
