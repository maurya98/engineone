# EngineOne — Data Flow Documentation

This document describes how data moves through the EngineOne system: **authentication**, **workspace/repo navigation**, **code (VCS) and JDM editing**, **simulation**, and **execute**.

---

## 1. Authentication flow

```mermaid
sequenceDiagram
  participant User
  participant Web as Web App
  participant API as API
  participant Redis as Redis/Memory Store
  participant DB as PostgreSQL

  User->>Web: Open app
  Web->>API: GET /users/me (credentials)
  alt Session valid
    API->>Redis: get session
    Redis-->>API: session + user
    API-->>Web: 200 { user }
    Web->>Web: AuthContext sets user
  else No/invalid session
    API-->>Web: 401
    Web->>User: Redirect to /login
  end

  User->>Web: Submit login
  Web->>API: POST /auth/login { email, password }
  API->>DB: find user, verify password
  DB-->>API: user
  API->>Redis: save session
  API-->>Web: 200 { user }
  Web->>Web: AuthContext sets user, redirect to /
```

- **Registration:** POST `/auth/register` → create user in DB → `req.login` → session stored (same store as login).
- **Logout:** POST `/auth/logout` → session destroyed.
- **Protected routes:** Frontend uses `ProtectedRoute`; API routes use `requireAuth` (and optionally `requireWorkspaceAdmin`, `requireRepoRole`). Session is read by Passport from cookie.

---

## 2. Workspace and repository navigation

```mermaid
flowchart LR
  subgraph Web
    A[Dashboard] --> B[GET /workspaces]
    A --> C[GET /workspaces/:id/repos]
    D[RepoPage] --> E[GET /repos/:id]
    D --> F[Code / Issues / Branches / PR / Wiki]
  end

  subgraph API
    B --> WS[WorkspaceService]
    C --> RS[RepoService]
    E --> RS
    WS --> DB[(PostgreSQL)]
    RS --> DB
  end
```

- **Dashboard:** Loads workspaces for user; when a workspace is selected, loads repos for that workspace. Repo click → navigate to `/workspaces/:workspaceId/repos/:repoId`.
- **RepoPage:** Loads repo meta (name, default_branch_name) via GET `/repos/:id`; then per-tab data (e.g. Code tab loads tree and files from VCS endpoints).

---

## 3. Code tab — load and edit flow

```mermaid
sequenceDiagram
  participant User
  participant CodeTab as CodeTab
  participant API
  participant VCS as vcs.service
  participant Blob as blob.service
  participant DB as DB/FS

  User->>CodeTab: Select branch
  CodeTab->>API: GET /repos/:id/branches
  API->>VCS: listBranches(repoId)
  VCS->>DB: Branch list
  API-->>CodeTab: { branches }

  CodeTab->>API: GET /repos/:id/tree?branch=main
  API->>VCS: getBranchByName, getTreeEntries(head)
  VCS->>DB: Branch, CommitTree
  API-->>CodeTab: { tree }

  User->>CodeTab: Click file (e.g. index.json)
  CodeTab->>CodeTab: draft[path] or getFileContent(path)
  CodeTab->>API: GET /repos/:id/files?branch=&path=index.json
  API->>VCS: getBranchByName, getTreeEntries
  API->>Blob: getBlob(repoId, blobId)
  Blob->>DB: read file from blobs/<repoId>/<blobId>
  API-->>CodeTab: file content
  CodeTab->>CodeTab: Parse JDM, set DecisionGraph / raw editor
```

- **Draft:** Edits are kept in component state; optionally persisted to **localStorage** (draftStorage) keyed by repoId and branch. No server round-trip until commit.
- **getFileContent:** If path is in `draft`, return draft; else GET `/repos/:id/files?branch=&path=...` → tree → blob → content.

---

## 4. Code tab — commit (save) flow

```mermaid
sequenceDiagram
  participant User
  participant CodeTab as CodeTab
  participant API
  participant VCS as vcs.service
  participant Blob as blob.service
  participant DB as DB/FS

  User->>CodeTab: Click Commit, enter message
  CodeTab->>CodeTab: Build tree payload (merged paths + draft content)
  CodeTab->>API: POST /repos/:id/commits { message, branch, tree }
  API->>VCS: getBranchByName, getTreeEntries(parent)
  loop For each tree entry
    alt file with content
      API->>Blob: putBlob(repoId, content)
      Blob->>DB: write blobs/<repoId>/<blobId>
    else file unchanged
      API->>API: use parent blob_id
    else folder
      API->>Blob: putBlob(repoId, '')
    end
  end
  API->>VCS: createCommit, insertTreeEntries, setBranchHead
  VCS->>DB: Commit, CommitTree, Branch update
  API-->>CodeTab: 201 { commit }
  CodeTab->>CodeTab: clear draft, reload tree, close dialog
```

- **Tree payload:** Each path with kind file/folder; for files, include `content` only when draft has changes (otherwise backend copies from parent tree).
- **Backend:** Same flow as in [VCS-MECHANISM.md](./VCS-MECHANISM.md): new commit, new tree entries, branch HEAD updated; blobs written by blob.service.

---

## 5. Simulate flow (JDM in browser)

```mermaid
sequenceDiagram
  participant User
  participant Simulator as GraphSimulator
  participant CodeTab as CodeTab
  participant API
  participant ZenEngine

  User->>Simulator: Run with graph + context
  Simulator->>CodeTab: onRun({ graph, context })
  CodeTab->>CodeTab: Resolve decision refs (key.json) from draft or getFileContent
  CodeTab->>API: POST /simulate { content: graph, context, decisions }
  API->>ZenEngine: createDecision(content), evaluate(context, { trace: true })
  ZenEngine->>ZenEngine: Evaluate nodes (load decisions via loader if present)
  ZenEngine-->>API: { result, trace, ... }
  API-->>CodeTab: 200 response
  CodeTab->>Simulator: setSimulate(result/trace or error)
  Simulator->>User: Show result / trace / error
```

- **Decisions:** If the graph has decision nodes with a `key`, CodeTab loads that key’s graph (e.g. `key.json`) from draft or via `getFileContent` and passes them in `decisions` to `/simulate`. The server uses them in ZenEngine’s loader so nested decisions are evaluated.
- **Trace:** Simulation runs with `trace: true` so the UI can show execution trace.

---

## 6. Execute flow (API, production rules)

```mermaid
sequenceDiagram
  participant Client
  participant API
  participant Validate as validateApiKey
  participant Repo as repo.service
  participant Tree as tree.service
  participant Blob as blob.service
  participant ZenEngine

  Client->>API: POST /execute { repoId, context, branch? } + X-Api-Key
  API->>Validate: validateApiKey(key)
  Validate->>DB: ApiKey by keyHash → repoId or workspaceId
  alt Invalid key
    API-->>Client: 401
  end
  API->>Repo: getRepositoryById(repoId)
  alt Scope check (repo/workspace)
    API-->>Client: 403
  end
  API->>Tree: getFileContent(repoId, branch, 'index.json')
  Tree->>VCS: getBranchByName, getTreeEntries
  Tree->>Blob: getBlob(repoId, blobId)
  Tree-->>API: index.json content
  alt index.json not found
    API-->>Client: 404
  end
  API->>API: Build loader(key => getFileContent(key.json))
  API->>ZenEngine: createDecision(graph), evaluate(context)
  ZenEngine->>API: loader(key) when decision node needs key.json
  API->>Tree: getFileContent(repoId, branch, key+'.json')
  Tree-->>ZenEngine: graph for key
  ZenEngine-->>API: result
  API-->>Client: 200 { result }
```

- **Auth:** Only API key; no session. Key is hashed (SHA-256); stored in `ApiKey` with optional `repoId` or `workspaceId` for scope.
- **Entry point:** Always `index.json` on the given branch. Nested decisions loaded on demand via loader → `getFileContent` → blob store.

---

## 7. End-to-end data flow diagram

```mermaid
flowchart TB
  subgraph Client
    Browser[Browser]
  end

  subgraph Web_App["Web App (React)"]
    AuthCtx[AuthContext]
    Dashboard[Dashboard]
    RepoPage[RepoPage]
    CodeTab[CodeTab]
    Simulator[GraphSimulator]
    API_Client[apiFetch / fetch]
  end

  subgraph API["API (Express)"]
    AuthMW[requireAuth / requireRepoRole]
    AuthR[Auth Routes]
    UserR[User Routes]
    WorkspaceR[Workspace Routes]
    ReposR[Repos + VCS + MR + Issues + Wiki]
    ExecuteR[Execute Route]
    SimulateR[Simulate Route]
  end

  subgraph Services["Services"]
    UserS[user.service]
    WorkspaceS[workspace.service]
    RepoS[repo.service]
    VcsS[vcs.service]
    TreeS[tree.service]
    BlobS[blob.service]
  end

  subgraph Data["Data"]
    PG[(PostgreSQL)]
    Redis[(Redis)]
    FS[(Blob FS)]
  end

  Browser <--> AuthCtx
  AuthCtx <--> API_Client
  Dashboard --> API_Client
  RepoPage --> API_Client
  CodeTab --> API_Client
  Simulator --> CodeTab
  CodeTab --> API_Client

  API_Client --> AuthR
  API_Client --> UserR
  API_Client --> WorkspaceR
  API_Client --> ReposR
  API_Client --> ExecuteR
  API_Client --> SimulateR

  AuthR --> UserS
  UserR --> UserS
  WorkspaceR --> WorkspaceS
  WorkspaceR --> RepoS
  ReposR --> RepoS
  ReposR --> VcsS
  ReposR --> TreeS
  ExecuteR --> RepoS
  ExecuteR --> TreeS
  SimulateR --> ZenEngine[ZenEngine]
  TreeS --> VcsS
  TreeS --> BlobS
  VcsS --> PG
  BlobS --> FS
  UserS --> PG
  WorkspaceS --> PG
  RepoS --> PG
  AuthMW --> Redis
```

---

## Summary table

| Flow | Trigger | Main API | Key services | Data stores |
|------|---------|----------|---------------|-------------|
| Login | User submits credentials | POST /auth/login | Passport, user.service | PostgreSQL, Redis |
| Workspaces/Repos | Dashboard load / nav | GET /workspaces, GET /workspaces/:id/repos | workspace.service, repo.service | PostgreSQL |
| Tree / file read | Branch select, file click | GET /repos/:id/tree, GET /repos/:id/files | vcs.service, tree.service, blob.service | PostgreSQL, FS |
| Commit | User commits in Code tab | POST /repos/:id/commits | vcs.service, blob.service | PostgreSQL, FS |
| Simulate | Run in Simulator | POST /simulate | ZenEngine (in-process) | Request body |
| Execute | External client | POST /execute (API key) | repo.service, tree.service, ZenEngine | PostgreSQL, FS |

For VCS details (commits, branches, blobs), see [VCS-MECHANISM.md](./VCS-MECHANISM.md). For API contracts, see [API-DOCUMENTATION.md](./API-DOCUMENTATION.md).
