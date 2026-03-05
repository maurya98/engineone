# EngineOne API Documentation

Base URL (development): `http://localhost:4000`

Authentication: Session-based (cookies). Use `credentials: 'include'` for browser requests.  
API key auth is used for the **Execute** endpoint only (see below).

---

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check. Returns `{ status: "ok" }`. |

---

## Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Register a new user. |
| POST | `/auth/login` | No | Log in (session). |
| POST | `/auth/logout` | Yes | Log out. |
| GET | `/auth/saml/login` | No | SAML login (501 Not Implemented). |
| POST | `/auth/saml/callback` | No | SAML callback (501 Not Implemented). |

### POST `/auth/register`

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "min8chars",
  "display_name": "Optional Name"
}
```

**Responses:** `201` with `{ user }`, `400` validation error, `409` email already registered.

### POST `/auth/login`

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Responses:** `200` with `{ user }`, `400` validation error, `401` invalid credentials.

---

## Users

All routes require authentication.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/me` | Get current user profile. |
| PATCH | `/users/me` | Update profile (`display_name`). |
| POST | `/users/me/change-password` | Change password. |
| GET | `/users/me/preferences` | Get user preferences (theme, font_size, font_style, icon_pack). |
| PATCH | `/users/me/preferences` | Update preferences. |

### PATCH `/users/me`

**Request body:** `{ "display_name": "New Name" }` (optional, nullable).

### POST `/users/me/change-password`

**Request body:**
```json
{
  "currentPassword": "current",
  "newPassword": "newmin8chars"
}
```

### PATCH `/users/me/preferences`

**Request body:** Any of:
- `theme`: `"light"` \| `"dark"` \| `"system"`
- `font_size`: string
- `font_style`: string
- `icon_pack`: string

---

## Workspaces

All routes require authentication.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/workspaces` | User | List workspaces for current user. |
| POST | `/workspaces` | Super Admin | Create workspace. |
| GET | `/workspaces/:workspaceId` | User + access | Get workspace. |
| PATCH | `/workspaces/:workspaceId` | Workspace Admin | Update workspace. |
| DELETE | `/workspaces/:workspaceId` | Super Admin | Delete workspace. |
| GET | `/workspaces/:workspaceId/repos` | User + access | List repositories. |
| POST | `/workspaces/:workspaceId/repos` | Workspace Admin | Create repository. |

### POST `/workspaces`

**Request body:** `{ "name": "Workspace Name" }`.

**Response:** `201` with `{ workspace }`.

### POST `/workspaces/:workspaceId/repos`

**Request body:** `{ "name": "Repo Name" }`.

**Response:** `201` with `{ repository }`. Creates repo with default branch `main` and initial commit.

---

## Repositories

All routes require authentication. Repo routes use role-based access: `qa`, `developer`, or `maintainer`.

| Method | Path | Min Role | Description |
|--------|------|----------|-------------|
| GET | `/repos/:id` | qa | Get repository. |
| GET | `/repos/:id/tree` | qa | Get file tree for branch. |
| GET | `/repos/:id/files` | qa | Get file content. |
| PATCH | `/repos/:id` | maintainer | Update repo (name, default_branch_name). |
| DELETE | `/repos/:id` | maintainer | Delete repository. |
| GET | `/repos/:id/members` | maintainer | List repo members. |
| POST | `/repos/:id/members` | maintainer | Add member. |
| DELETE | `/repos/:id/members/:userId` | maintainer | Remove member. |

### GET `/repos/:id/tree`

**Query:** `branch` (optional, default: repo default branch).

**Response:** `{ branch, tree }` where `tree` is `[{ path, blob_id, kind: "file"|"folder" }]`.

### GET `/repos/:id/files`

**Query:** `branch`, `path` (required).

**Response:** Raw file content (e.g. JSON). `Content-Type: application/json` for JSON.

### POST `/repos/:id/members`

**Request body:** `{ "user_id": "uuid", "role": "maintainer"|"developer"|"qa" }`.

---

## VCS (Version Control) — under `/repos/:id`

All VCS routes require authentication and at least `developer` role unless noted.

| Method | Path | Min Role | Description |
|--------|------|----------|-------------|
| GET | `/repos/:id/commits` | developer | List commits. |
| GET | `/repos/:id/commits/graph` | developer | List commits (graph shape). |
| POST | `/repos/:id/commits` | maintainer | Create commit. |
| GET | `/repos/:id/branches` | developer | List branches. |
| POST | `/repos/:id/branches` | developer | Create branch. |
| DELETE | `/repos/:id/branches/:name` | developer | Delete branch. |
| PATCH | `/repos/:id/branches/:name` | maintainer | Update branch (e.g. is_protected). |
| POST | `/repos/:id/branches/:name/reset` | maintainer | Reset branch to commit. |
| GET | `/repos/:id/compare` | developer | Compare two refs. |
| GET | `/repos/:id/tags` | developer | List tags. |
| POST | `/repos/:id/tags` | maintainer | Create tag. |
| DELETE | `/repos/:id/tags/:name` | maintainer | Delete tag. |

### GET `/repos/:id/commits`

**Query:** `branch` (default `main`), `limit` (default 50, max 100).

**Response:** `{ commits }` — array of commit objects with `author_email` when available.

### POST `/repos/:id/commits`

**Request body:**
```json
{
  "message": "Commit message",
  "branch": "main",
  "tree": [
    { "path": "path/to/file.json", "kind": "file", "content": "optional content" },
    { "path": "folder/", "kind": "folder" }
  ]
}
```

- `content` only for files; omit to keep parent blob. New files need `content`.  
**Response:** `201` with `{ commit }`.

### POST `/repos/:id/branches`

**Request body:** `{ "name": "feature-x", "source": "main" }`.

**Response:** `201` with `{ branch }`.

### GET `/repos/:id/compare`

**Query:** `base` (default `main`), `head` (required).

**Response:** `{ base, head, changes }` — `changes`: `{ path, change: "add"|"modify"|"delete", base_blob_id?, head_blob_id? }`.

### POST `/repos/:id/tags`

**Request body:** `{ "name": "v1.0", "commit_id": "uuid" }` — `commit_id` optional (defaults to main HEAD).

---

## Merge Requests — under `/repos/:id/merge_requests`

| Method | Path | Min Role | Description |
|--------|------|----------|-------------|
| GET | `/repos/:id/merge_requests` | developer | List merge requests. |
| POST | `/repos/:id/merge_requests` | developer | Create MR. |
| GET | `/repos/:id/merge_requests/:mrId` | developer | Get MR. |
| PATCH | `/repos/:id/merge_requests/:mrId` | developer | Update MR. |
| POST | `/repos/:id/merge_requests/:mrId/merge` | maintainer | Merge MR. |
| POST | `/repos/:id/merge_requests/:mrId/watchers` | developer | Watch MR. |
| DELETE | `/repos/:id/merge_requests/:mrId/watchers/me` | developer | Unwatch MR. |

### POST `/repos/:id/merge_requests`

**Request body:** `{ "source_branch": "feature", "target_branch": "main", "title": "Title", "description": "Optional" }`.

### POST `/repos/:id/merge_requests/:mrId/merge`

Merges source branch into target (creates merge commit, updates target HEAD).

---

## Issues — under `/repos/:id/issues`

| Method | Path | Min Role | Description |
|--------|------|----------|-------------|
| GET | `/repos/:id/issues` | qa | List issues. |
| POST | `/repos/:id/issues` | qa | Create issue. |
| GET | `/repos/:id/issues/:issueId` | qa | Get issue. |
| PATCH | `/repos/:id/issues/:issueId` | qa | Update issue. |

**Query (list):** `branch`, `status` (e.g. `open`, `resolved`, `closed`).

**Create body:** `{ "branch": "main", "title": "Title", "description": "Optional" }`.

---

## Wiki — under `/repos/:id/wiki`

| Method | Path | Min Role | Description |
|--------|------|----------|-------------|
| GET | `/repos/:id/wiki` | qa | List pages. |
| GET | `/repos/:id/wiki/:slug` | qa | Get page. |
| POST | `/repos/:id/wiki` | developer | Create/upsert page. |
| PATCH | `/repos/:id/wiki/:slug` | developer | Update page. |
| DELETE | `/repos/:id/wiki/:slug` | maintainer | Delete page. |

Slug: `[a-z0-9-_]+`. **Create body:** `{ "slug", "title", "body?" }`.

---

## Execute (Rule Engine)

**Authentication:** API key via header `X-Api-Key` or body `apiKey`. Key can be scoped to a repo or workspace.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/execute` | API Key | Evaluate decision graph for a repo. |

### POST `/execute`

**Request body:**
```json
{
  "repoId": "uuid",
  "context": { "key": "value" },
  "branch": "main"
}
```

- `branch` optional; defaults to repo default branch.  
- Loads `index.json` from the branch; ZenEngine evaluates with optional loader for nested decisions (`key.json`).

**Response:** `200` with `{ result }` (evaluation result).  
**Errors:** `401` missing/invalid API key, `403` key has no access to repo, `404` index.json not found, `500` execution error.

---

## Simulate (Rule Engine)

Used to run a decision graph in "simulation" mode (e.g. from the JDM editor) with optional trace. No API key; session optional (currently unauthenticated).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/simulate` | Optional | Evaluate a graph payload with optional context and nested decisions. |

### POST `/simulate`

**Request body:**
```json
{
  "content": { "nodes": [], "edges": [] },
  "context": {},
  "decisions": { "decisionKey": { "nodes": [], "edges": [] } }
}
```

- `content`: JDM graph (nodes, edges).  
- `context`: input context for the decision.  
- `decisions`: optional map of decision key → JDM graph for decision nodes.

**Response:** Full ZenEngine response (includes `result`, `trace` when `trace: true`).  
**Errors:** `400` validation, `500` with `details` and optional `data.nodeId`.

---

## Error format

- **4xx/5xx:** JSON `{ "error": "message", "details": ... }`.  
- Validation: `details` may be Zod `flatten()` shape.  
- Execute/Simulate may include `data: { nodeId, type, source }`.

---

## Roles summary

| Role | Scope | Capabilities |
|------|--------|----------------|
| super_admin | Global | All workspaces/repos; create/delete workspaces. |
| admin | Workspace | Workspace settings; treat as maintainer on all repos. |
| member | Workspace | List repos; access by repo role. |
| maintainer | Repo | Settings, members, branches, commits, merge, wiki delete, protected branch. |
| developer | Repo | VCS read/write, create branches/commits, wiki edit, MRs. |
| qa | Repo | Read repo, tree, files; issues; wiki read. |
