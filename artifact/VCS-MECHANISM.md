# EngineOne — VCS Mechanism (Version Control System)

This document describes the **VCS (Version Control System)** used by EngineOne for repositories. The backend implements a Git-like model: **commits**, **branches**, **trees**, and **blobs**, with **tags** and **merge requests** on top.

*(Note: “VSC” in the documentation request is interpreted as **VCS** — Version Control System — which is the term used in the codebase: `vcs.service.ts`, `vcs.routes.ts`.)*

---

## Overview

- **Storage:** PostgreSQL for metadata (commits, branches, trees, tags, merge requests); file system for **blob** content (one file per blob per repo).
- **Identifiers:** Blobs are identified by SHA-256 hash of content. Commits and branches use UUIDs.
- **API:** All VCS operations are under `/repos/:id/` (see [API-DOCUMENTATION.md](./API-DOCUMENTATION.md)).

---

## Core concepts

### 1. Blob

- **What:** Immutable content store. Content is keyed by **blob ID** = `SHA256(content)` (hex).
- **Where:** File system under `BLOB_STORAGE_DIR` (default `blobs/`), per repo: `blobs/<repoId>/<blobId>`.
- **Who:** `blob.service.ts`: `computeBlobId`, `putBlob`, `getBlob`. Used when creating commits (tree entries point to blob IDs) and when reading file content (tree → blob ID → blob content).

### 2. Commit

- **What:** A snapshot of the repo at a point in time. Each commit has:
  - **Parent:** One parent commit (or none for initial commit).
  - **Tree:** Set of entries (path → blob ID, kind file/folder). Stored in `CommitTree` (commitId, path, blobId, kind).
- **Who:** `vcs.service.ts`: `createCommit`, `getCommitById`, `listCommits` (walk parent chain), `insertTreeEntries`, `getTreeEntries`.

### 3. Branch

- **What:** A named pointer to a commit (HEAD). Default branch (e.g. `main`) set on repository.
- **Who:** `vcs.service.ts`: `getBranchByName`, `getBranchById`, `createBranch`, `setBranchHead`, `listBranches`. Branches can be **protected** (only maintainers can push); enforced in `vcs.routes.ts` on POST commits.

### 4. Tag

- **What:** Named reference to a commit (read-only). Optional `commit_id`; if omitted, tag points to current main HEAD.
- **Who:** Prisma `Tag` model; routes in `vcs.routes.ts`: GET/POST/DELETE tags.

### 5. Tree (commit tree)

- **What:** The set of paths and blob IDs for a commit. Stored as rows in `CommitTree`: (commitId, path, blobId, kind). “Folder” entries use a placeholder blob (e.g. empty string) for consistency.
- **Who:** `vcs.service.ts`: `getTreeEntries`, `insertTreeEntries`. Used by `tree.service.ts` to implement “file tree for branch” and “file content for path”.

---

## Data flow (high level)

```text
                    ┌─────────────────────────────────────────────────────────┐
                    │                     Repository                           │
                    │  default_branch_name (e.g. "main")                       │
                    └───────────────────────────┬─────────────────────────────┘
                                                │
                    ┌───────────────────────────▼─────────────────────────────┐
                    │  Branch (e.g. main)                                      │
                    │  head_commit_id ──────────────────────────────────────►│
                    └───────────────────────────┬─────────────────────────────┘
                                                │
                    ┌───────────────────────────▼─────────────────────────────┐
                    │  Commit                                                  │
                    │  parent_commit_id (chain)                               │
                    │  author_id, message, created_at                         │
                    └───────────────────────────┬─────────────────────────────┘
                                                │
                    ┌───────────────────────────▼─────────────────────────────┐
                    │  CommitTree (path, blob_id, kind)                        │
                    │  e.g. "index.json" → blob_abc, "folder/" → blob_empty   │
                    └───────────────────────────┬─────────────────────────────┘
                                                │
                    ┌───────────────────────────▼─────────────────────────────┐
                    │  Blob (filesystem: blobs/<repoId>/<blobId>)             │
                    │  Raw content (JSON, text, etc.)                         │
                    └─────────────────────────────────────────────────────────┘
```

---

## Creating a commit (POST `/repos/:id/commits`)

1. **Auth:** User must be authenticated and have at least **maintainer** role (or satisfy protected-branch rules).
2. **Body:** `message`, `branch`, `tree` (array of `{ path, kind, content? }`).
3. **Resolve branch:** Load branch by name; get current `head_commit_id` (parent).
4. **Build new tree:**
   - For each entry:
     - **Folder:** Create/use empty blob; add entry (path, blobId, kind=folder).
     - **File with content:** Hash content → blobId; store blob on disk; add entry (path, blobId, kind=file).
     - **File without content:** Copy from parent tree at same path (unchanged file); if not in parent, store empty blob.
5. **Create commit:** Insert `Commit` (repoId, authorId, parentCommitId, message).
6. **Persist tree:** Insert all new (commitId, path, blobId, kind) into `CommitTree`.
7. **Update branch:** Set branch’s `head_commit_id` to the new commit.

Result: Branch HEAD moves to the new commit; that commit’s tree points to blobs; blobs live in the repo’s blob directory.

---

## Reading file content (GET `/repos/:id/files`)

1. **Resolve branch** → get branch’s `head_commit_id`.
2. **Get tree:** `getTreeEntries(commitId)` → list of (path, blob_id, kind).
3. **Find path:** Match requested `path` and kind=file in tree.
4. **Load blob:** `getBlob(repoId, blob_id)` reads from filesystem.
5. **Response:** Return blob content (e.g. with `Content-Type: application/json` for JSON).

Same chain is used by **tree.service** for “tree for branch” (list paths) and “file content” (used by execute loader and by the Code tab).

---

## Compare (GET `/repos/:id/compare`)

- **Query:** `base`, `head` (branch names or commit IDs).
- **Resolve:** `resolveToCommitId(repoId, base)` and `resolveToCommitId(repoId, head)` (branch name → branch.head_commit_id, or commit ID if valid).
- **Trees:** Get `getTreeEntries(baseCommitId)` and `getTreeEntries(headCommitId)`.
- **Diff:** Compare path sets and blob IDs to produce `add` / `modify` / `delete` per path.

---

## Merge request merge (POST `/repos/:id/merge_requests/:mrId/merge`)

- **Load MR:** Source and target branches.
- **New commit:** Create a commit with:
  - **Parent:** Target branch’s HEAD (not source).
  - **Tree:** Copy **source** branch’s tree entries into this commit (so target HEAD becomes a merge commit whose tree matches source).
- **Update target:** Set target branch’s `head_commit_id` to this new commit.
- **Update MR:** Set status to `merged`, set `merge_commit_id` to the new commit.

So the merge is “make target’s HEAD a new commit that points to source’s tree” (single parent; no three-way merge or diff-based patch).

---

## Roles and protection

- **Branches:** Can be marked **protected**. For protected branches, only **maintainer** (or super_admin) can create commits (enforced in POST `/repos/:id/commits`).
- **Default branch:** Cannot be deleted (e.g. “main”).
- **Tags:** Create/delete only by **maintainer**; list/read by **developer**.

---

## Services summary

| Service | Responsibility |
|---------|----------------|
| **vcs.service** | Branches, commits, commit tree (get/insert), list commits, resolve ref to commit ID. |
| **blob.service** | Compute blob ID (SHA-256), read/write blob files per repo. |
| **tree.service** | High-level “tree for branch” and “file content for path” (uses VCS + blob). |

The **execute** and **simulate** flows use the same VCS + blob model: execute loads `index.json` (and optional `key.json` via loader) from a branch’s tree; simulate receives graph/content in the request body and does not read from VCS.

For API details (request/response shapes, query params), see [API-DOCUMENTATION.md](./API-DOCUMENTATION.md). For data flow diagrams, see [DATA-FLOW.md](./DATA-FLOW.md).
