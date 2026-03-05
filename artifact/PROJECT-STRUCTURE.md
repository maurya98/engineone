# EngineOne — Project Structure

EngineOne is a monorepo for a **Decision/Rule Repository** platform: workspaces, repositories with Git-like version control (VCS), JDM (JSON Decision Model) editing, simulation, and API-based execution via ZenEngine.

---

## Repository layout (top level)

```
engineone/
├── apps/
│   ├── api/          # Express backend (Node.js)
│   └── web/          # React SPA (Vite)
├── packages/
│   ├── jdm-editor/   # JDM graph editor (React, ReactFlow, Monaco)
│   ├── zen-engine-wasm/  # Zen expression engine (Rust → WASM)
│   ├── lezer-zen/    # Zen language grammar (Lezer)
│   └── lezer-zen-template/  # Zen template grammar
├── artifact/         # Documentation (this folder)
├── package.json      # Workspace root
└── ...
```

---

## Apps

### `apps/api` — Backend API

- **Runtime:** Node.js (>=18)
- **Framework:** Express
- **Database:** PostgreSQL via Prisma
- **Session:** Redis (or in-memory fallback), `express-session`, Passport (local + SAML stubs)
- **Auth:** Session cookies; API keys for `/execute` only

**Key directories:**

| Path | Purpose |
|------|---------|
| `src/` | Application source |
| `src/app.ts` | Express app creation, middleware, route mounting |
| `src/index.ts` | Entry point, seed, server listen |
| `src/config.ts` | Env-based config (port, Redis, DB, session, superadmin) |
| `src/routes/` | Route modules: auth, users, workspaces, repos, vcs, merge-requests, issues, wiki, execute, simulate |
| `src/middleware/` | Auth: requireAuth, requireSuperAdmin, requireWorkspaceAdmin, requireRepoRole |
| `src/services/` | Business logic: user, workspace, repo, vcs, tree, blob |
| `src/db/` | Prisma client, schema, seed |
| `src/types/` | Express augmentation, user/workspace DTOs |
| `src/utils/` | Helpers (e.g. param extraction) |

**Route mounting (from app.ts):**

- `/auth` — authRouter  
- `/users` — usersRouter  
- `/workspaces` — workspacesRouter  
- `/repos` — reposRouter (nested: vcs, merge_requests, issues, wiki under `/:id`)  
- `/execute` — executeRouter  
- `/simulate` — simulateRouter  
- `/health` — GET health check  

---

### `apps/web` — Frontend SPA

- **Stack:** React 18, React Router 6, Vite
- **UI:** Ant Design icons; `@gorules/jdm-editor` for decision editing and simulation
- **API:** `lib/api.ts` — `apiFetch()` with credentials; relative paths (proxied to API in dev)

**Key directories:**

| Path | Purpose |
|------|---------|
| `src/` | Application source |
| `src/App.tsx` | Routes, ProtectedRoute, ThemeProviderWithPrefs |
| `src/main.tsx` | React root |
| `src/pages/` | Dashboard, Login, Register, Profile, Preferences, RepoPage |
| `src/components/` | Layout, Modal, repo/CodeTab, icons |
| `src/context/` | AuthContext, ThemeContext |
| `src/lib/` | api.ts, draftStorage (localStorage for Code tab drafts) |

**Routes:**

- `/login`, `/register` — public  
- `/` — protected; Layout with sidebar  
- `/` — Dashboard (workspace list / repo list when workspace selected)  
- `/workspaces/:workspaceId` — same Dashboard with workspace context  
- `/profile`, `/preferences` — user settings  
- `/workspaces/:workspaceId/repos/:repoId/*` — RepoPage (tabs: Code, Issues, Branches, Pull Requests, Wiki, Settings)  

**Code tab:** Repo code view; file tree; branch selector; JDM editor for `.json` files; Simulator calling `/simulate`; commit via `/repos/:id/commits`.

---

## Packages

### `packages/jdm-editor` (@gorules/jdm-editor)

- **Purpose:** Visual editor for JSON Decision Model (JDM) graphs and integrated simulator.
- **Stack:** React, ReactFlow, Monaco, CodeMirror, Ant Design, Zustand, etc.
- **Consumed by:** `apps/web` (Code tab).
- **Exports:** Editor components, schema (e.g. `decisionModelSchema`), styles.
- **Notable:** Uses `@gorules/zen-engine-wasm` for expression evaluation in the editor.

### `packages/zen-engine-wasm`

- **Purpose:** Zen expression/template evaluation compiled to WebAssembly.
- **Language:** Rust; builds to WASM for browser (and used by jdm-editor).
- **Used by:** jdm-editor (and indirectly by API via `@gorules/zen-engine` for execute/simulate).

### `packages/lezer-zen` / `packages/lezer-zen-template`

- **Purpose:** Lezer grammars for Zen language and Zen templates.
- **Used by:** jdm-editor (parsing/highlighting).

---

## Build and run

- **Root:** `npm run build` — build all workspaces; `npm run dev` — run API + web in parallel.
- **API:** `npm run dev --workspace=apps/api` (default port 4000).
- **Web:** `npm run dev --workspace=apps/web` (Vite dev server; proxy to API if configured).

---

## Configuration (API)

- **Env:** `dotenv` in `apps/api/src/config.ts`.
- **Variables:**  
  `PORT`, `NODE_ENV`, `SESSION_SECRET`, `REDIS_URL`, `DATABASE_URL`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `BLOB_STORAGE_DIR` (optional, for blob service).

---

## Database (Prisma)

- **Schema:** `apps/api/src/db/generated/schema.prisma` (generated path; source may be `schema.prisma` in db folder).
- **Models:** User, UserPreferences, Workspace, WorkspaceMember, Repository, RepoMember, Commit, CommitTree, Branch, Tag, Blob storage (filesystem), RepoWebhook, MergeRequest, MergeRequestWatcher, Issue, WikiPage, ApiKey.
- **Client:** `apps/api/src/db/prisma.ts`; generate with Prisma CLI from repo root or `apps/api`.

---

## Summary

| Layer | Location | Tech |
|-------|----------|------|
| Backend API | `apps/api` | Express, Prisma, PostgreSQL, Redis, Passport |
| Frontend | `apps/web` | React, Vite, React Router, JDM Editor |
| JDM editing | `packages/jdm-editor` | ReactFlow, Monaco, Zen WASM |
| Zen engine (browser) | `packages/zen-engine-wasm` | Rust → WASM |
| Grammars | `packages/lezer-zen*` | Lezer |
| Docs | `artifact/` | Markdown (API, structure, VCS, data flow, class diagram) |
