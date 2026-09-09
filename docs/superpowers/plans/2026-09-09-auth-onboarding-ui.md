# Authentication and Onboarding UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a usable first-run experience with one-time bootstrap, password login, profile/goal setup, session-protected business APIs, and a mobile-first React frontend served by the same container.

**Architecture:** Reuse the existing `@nutrition-tracker/auth` scrypt and stateful SQLite session service. Add a focused `@nutrition-tracker/profile` application service for profile and nutrition-goal persistence, then make the API resolve `userId` from the HttpOnly session cookie before serving food, diary, dashboard, profile, and goal routes. Build `apps/web` with React/Vite; the UI uses a small API client and route state (`status → bootstrap → login → setup → dashboard`) and is emitted into the API runtime's static directory.

**Tech Stack:** Node.js 24, TypeScript, node:sqlite, Vitest, React 19, Vite, CSS, pnpm workspaces, single Docker runtime.

**Spec:** `plan/nutrition_tracker_tech_manual_2026-09-08/IMPLEMENTATION_ROADMAP.md` M1-007, `API_SPEC.md` sections 4–6, `UI_DESIGN_SYSTEM.md`, and decision DEC-009 in `DEVELOPMENT_PROGRESS.md`.

## Global Constraints

- Session tokens are stored only as SHA-256 hashes; cookies are HttpOnly, SameSite=Lax, path `/`, and secure only when explicitly configured.
- Bootstrap is one-time; password hashes use the existing scrypt service and raw passwords never enter logs or persistence.
- All business routes require an authenticated session and use the session `userId`; no route may use the legacy `local-user` fallback.
- API errors retain the existing `{error:{code,message,requestId}}` envelope.
- UI targets 360/390/430px without horizontal overflow, uses 44px interactive targets, visible focus, reduced-motion support, and non-color status text.
- All changes use TDD: write the failing test, observe RED, implement the minimum, then run focused and full gates.

### Task 1: Profile and goal application service

**Files:**
- Create: `packages/profile/package.json`, `packages/profile/tsconfig.json`, `packages/profile/src/index.ts`, `packages/profile/test/profile.test.ts`
- Modify: `tsconfig.json`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `DatabaseSync`, `profile_user`, `profile_body_profile`, and `profile_nutrition_goal` tables.
- Produces: `createProfileService(sqlite).getProfile(userId)`, `.updateProfile(userId, patch)`, `.listGoals(userId)`, and `.createGoal(userId, input)`.

- [ ] **Step 1: Write failing service tests** for profile defaults, validation, upsert behavior, goal creation, and closing the previous active goal.
- [ ] **Step 2: Run `pnpm vitest run packages/profile/test/profile.test.ts` and verify RED** because the package and service do not exist.
- [ ] **Step 3: Implement the minimal profile service** with ISO date validation, numeric bounds, allowed enum validation, `BEGIN IMMEDIATE` goal rotation, and stable response DTOs.
- [ ] **Step 4: Run the focused profile tests and `pnpm typecheck`**; expect all profile tests green.
- [ ] **Step 5: Commit** with `feat: add profile and nutrition goal service`.

### Task 2: Session-protected auth/bootstrap/profile HTTP API

**Files:**
- Create: `apps/api/test/auth-routes.test.ts`, `apps/api/test/profile-routes.test.ts`
- Modify: `apps/api/src/index.ts`, `apps/api/package.json`, `plan/.../API_SPEC.md`, existing API route tests

**Interfaces:**
- Public: `GET /api/v1/auth/status`, `POST /api/v1/auth/bootstrap`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/session`.
- Protected: `GET/PATCH /api/v1/profile`, `GET/POST /api/v1/profile/goals`.
- Contract: bootstrap `{displayName,password,timezone?}` returns `{data:{user}}` and sets a session cookie; status returns `{data:{initialized}}`; unauthenticated session returns `{data:{authenticated:false,user:null}}`; authenticated session returns user data.

- [ ] **Step 1: Add failing HTTP tests** for status/bootstrap-once, cookie login/logout, generic invalid credentials, protected-route 401, profile patch, and goal rotation.
- [ ] **Step 2: Run the focused route tests and verify RED** against the current server.
- [ ] **Step 3: Add auth/profile service wiring and cookie parsing/clearing**; convert route errors to the common envelope and return 401/409/400 as specified.
- [ ] **Step 4: Replace every `local-user` route argument with the authenticated user id**, while allowing only health, static files, auth status/bootstrap/login, and readiness routes before login.
- [ ] **Step 5: Update existing diary/food/dashboard route fixtures** to bootstrap and retain the cookie, then run focused route tests and full `pnpm test`.
- [ ] **Step 6: Update `API_SPEC.md`** with the exact status/bootstrap/session/profile contracts and commit `feat: expose authenticated onboarding api`.

### Task 3: React/Vite frontend and onboarding state flow

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/api.ts`, `apps/web/src/styles.css`, `apps/web/src/flow.ts`, `apps/web/test/flow.test.ts`, `apps/web/test/api.test.ts`
- Modify: `pnpm-workspace.yaml`, root `package.json`, `tsconfig.json`, `pnpm-lock.yaml`

**Interfaces:**
- `api.ts` exports typed `getAuthStatus`, `bootstrap`, `login`, `logout`, `getSession`, `getProfile`, `updateProfile`, `createGoal`, `getDashboard`, `getDiary`, `searchFoods`, and `createDiaryEntry` using `credentials: "include"`.
- `flow.ts` exports a pure `nextScreen(state, event)` reducer used by `App.tsx` for `status`, `bootstrap`, `login`, `setup`, and `dashboard` transitions.

- [ ] **Step 1: Add failing reducer/API-client tests** for initialization routing, login errors, setup completion, date query encoding, and credentials inclusion.
- [ ] **Step 2: Run focused web tests and verify RED** because `apps/web` has no implementation.
- [ ] **Step 3: Scaffold the Vite React app** and implement typed API calls plus the pure flow reducer.
- [ ] **Step 4: Implement accessible screens**: first-run bootstrap form, login form, profile/goal setup form, and dashboard/meal shell with loading/error/offline states; keep controls at least 44px and include text labels for status.
- [ ] **Step 5: Add responsive CSS** for 360/390/430px, visible focus, `prefers-reduced-motion`, and no horizontal overflow; run `pnpm --filter @nutrition-tracker/web build` and focused tests.
- [ ] **Step 6: Commit** with `feat: add mobile onboarding and dashboard web app`.

### Task 4: Serve the built frontend from the API and Docker image

**Files:**
- Modify: `apps/api/src/index.ts`, `apps/api/test/static-routes.test.ts`, `apps/api/package.json`, `Dockerfile`, `.dockerignore`, `.github/workflows/ci.yml`, `docker-compose.yml`, `scripts/api-smoke.mjs`

**Interfaces:**
- API option `webDistDir?: string`; GET `/` and non-API client routes serve `index.html` from that directory; missing assets return 404 without swallowing API errors.
- Root `build` builds web before API; Docker copies `apps/web/dist` into the runtime image; existing `/healthz` and `/readyz` remain unchanged.

- [ ] **Step 1: Add failing static-route tests** for `/`, `/login`, an asset, and unknown API 404.
- [ ] **Step 2: Run the focused static tests and verify RED** because the API currently emits the placeholder page.
- [ ] **Step 3: Implement safe static-file serving** with path traversal protection and preserve API routing precedence.
- [ ] **Step 4: Update workspace build, Docker multi-stage copy, Compose environment, and smoke assertions**; run web build, API tests, full lint/typecheck/test/build/API smoke.
- [ ] **Step 5: Record Docker CLI limitation if local Docker is unavailable** and commit `feat: package web assets in application image`.

### Task 5: Final verification and handoff

**Files:**
- Modify: `plan/nutrition_tracker_tech_manual_2026-09-08/DEVELOPMENT_PROGRESS.md`, `apps/web/README.md`

- [ ] **Step 1: Run the complete gates**: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm build`, `pnpm api:smoke`, `pnpm docker:smoke`.
- [ ] **Step 2: Run the M1-007 focused tests** and capture test counts, exit codes, and any Docker limitation.
- [ ] **Step 3: Update API/UI/deployment docs and progress evidence**, including current focus, next step, handoff summary, and the exact commit.
- [ ] **Step 4: Commit docs and only mark M1-007 `DONE` if every planned acceptance command has evidence; otherwise leave it `IN_PROGRESS` or `BLOCKED` with the specific reason.**
