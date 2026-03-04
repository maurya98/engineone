# EngineOne – Rule Engine Platform

Full-stack Rule Engine platform with workspace/repository management, Git-like VCS, and JDM (JSON Decision Model) editing. Built with TypeScript, Express, Postgres, Redis, and React.

## Structure

- **apps/api** – Express backend (auth, workspaces, repos, VCS, MR, issues, wiki, `/execute` for rule execution)
- **apps/web** – React frontend (Vite)
- **packages/jdm-editor** – JDM editor (fork of [maurya98/jdm-editor](https://github.com/maurya98/jdm-editor))
- **packages/lezer-zen**, **packages/lezer-zen-template**, **packages/zen-engine-wasm** – JDM editor dependencies

## Prerequisites

- Node 18+
- PostgreSQL
- Redis (optional; falls back to in-memory session store)

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment**
   - Create `apps/api/.env` (optional) with:
     - `DATABASE_URL` – Postgres connection string (default: `postgresql://localhost:5432/engineone`)
     - `REDIS_URL` – Redis URL (default: `redis://localhost:6379`)
     - `SESSION_SECRET` – session secret

3. **Database**
   - Create a Postgres database named `engineone` (or set `DATABASE_URL`).
   - On first run, the API runs migrations automatically.

4. **Run**
   - Backend: `npm run dev:api` (or `cd apps/api && npm run dev`) – listens on port 4000.
   - Frontend: `npm run dev:web` (or `cd apps/web && npm run dev`) – Vite dev server on port 3000 with proxy to API.

## Key features

- **Auth**: Email register/login, session (Redis or memory), optional SAML (stub).
- **Workspaces**: Created by super-admin only; workspace admins manage repos.
- **Repos**: File tree and blobs; default branch `main` with initial commit.
- **VCS**: Branches, commits, tags, compare/diff, hard reset, protected branches.
- **Merge requests**: Create, merge (fast-forward), watchers.
- **Issues**: Branch-scoped; open/resolved/closed.
- **Wiki**: Repo-scoped pages (slug, title, body).
- **Execute API**: `POST /execute` with `{ repoId, context, branch? }` and `X-Api-Key` (or body `apiKey`). Runs **index.json** in the given branch via [zen-engine](https://github.com/gorules/zen-engine). API keys are stored in `api_keys` (key_hash, repo_id or workspace_id).

## API keys for /execute

Insert a row into `api_keys` with a hashed key and `repo_id` or `workspace_id`:

- `key_hash`: `SHA256(api_key)`
- Send the raw API key in the `X-Api-Key` header or in the request body as `apiKey` when calling `POST /execute`.

## License

MIT (see respective packages for JDM editor and zen-engine licenses).
