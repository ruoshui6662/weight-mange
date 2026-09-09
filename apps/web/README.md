# Web application

The React/Vite application provides the first-run bootstrap, password login, profile/goal setup,
Dashboard and quick diary entry flow. It is built into `dist/` and copied into the API runtime at
`/app/web`; the API serves the app shell and static assets from that directory.

Local commands:

```bash
pnpm --filter @nutrition-tracker/web test
pnpm --filter @nutrition-tracker/web build
```
