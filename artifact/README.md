# EngineOne — Documentation Artifacts

This folder contains detailed documentation for the **EngineOne** project (decision/rule repository platform with workspaces, repos, VCS, JDM editing, simulation, and execute API).

---

## Contents

| Document | Description |
|----------|-------------|
| **[API-DOCUMENTATION.md](./API-DOCUMENTATION.md)** | Full REST API reference: auth, users, workspaces, repos, VCS, merge requests, issues, wiki, execute, simulate. Request/response shapes, roles, and error formats. |
| **[PROJECT-STRUCTURE.md](./PROJECT-STRUCTURE.md)** | Repository layout, apps (`api`, `web`), packages (`jdm-editor`, `zen-engine-wasm`, lezer-zen), config, and build/run. |
| **[CLASS-DIAGRAM.md](./CLASS-DIAGRAM.md)** | Mermaid class diagrams: domain/Prisma models, API services and routes, auth middleware, frontend components, execute flow. |
| **[VCS-MECHANISM.md](./VCS-MECHANISM.md)** | Version Control System: blobs, commits, branches, trees, tags. How commits are created, file content resolved, compare and merge. |
| **[DATA-FLOW.md](./DATA-FLOW.md)** | Data flow with diagrams: authentication, workspace/repo navigation, code tab load/commit, simulate, execute, and an end-to-end flowchart. |

---

## Viewing diagrams

The class and data-flow documents use **Mermaid** for diagrams. To view them:

- **GitHub / GitLab:** Renders Mermaid in Markdown automatically.
- **VS Code:** Use a Mermaid extension (e.g. “Markdown Preview Mermaid Support”).
- **Online:** Copy the Mermaid block into [mermaid.live](https://mermaid.live).

---

## Quick links

- **API base URL (dev):** `http://localhost:4000`
- **Auth:** Session (cookies) for web; API key only for `POST /execute`
- **VCS:** Git-like model (commits, branches, blob store); API under `/repos/:id/` (commits, branches, tags, compare)
