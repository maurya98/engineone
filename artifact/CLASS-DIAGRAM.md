# EngineOne — Class Diagram

Below is a high-level class/module diagram for the main domain and API layer. It focuses on **backend (API)** and **core services**; frontend components are summarized separately.

---

## Domain & data model (Prisma / service layer)

```mermaid
classDiagram
  class User {
    +String id
    +String email
    +String passwordHash
    +String role
    +String samlId
    +String displayName
    +DateTime createdAt
    +DateTime updatedAt
  }

  class UserPreferences {
    +String userId
    +String theme
    +String fontSize
    +String fontStyle
    +String iconPack
  }

  class Workspace {
    +String id
    +String name
    +String createdBy
    +DateTime createdAt
    +DateTime updatedAt
  }

  class WorkspaceMember {
    +String workspaceId
    +String userId
    +String role
  }

  class Repository {
    +String id
    +String workspaceId
    +String name
    +String defaultBranchName
    +DateTime createdAt
    +DateTime updatedAt
  }

  class RepoMember {
    +String repoId
    +String userId
    +String role
  }

  class Commit {
    +String id
    +String repoId
    +String authorId
    +String parentCommitId
    +String message
    +DateTime createdAt
  }

  class CommitTree {
    +String commitId
    +String path
    +String blobId
    +String kind
  }

  class Branch {
    +String id
    +String repoId
    +String name
    +String headCommitId
    +Boolean isProtected
    +DateTime createdAt
  }

  class Tag {
    +String id
    +String repoId
    +String name
    +String commitId
    +String createdBy
    +DateTime createdAt
  }

  class MergeRequest {
    +String id
    +String repoId
    +String sourceBranchId
    +String targetBranchId
    +String title
    +String description
    +String status
    +String authorId
    +String mergeCommitId
    +DateTime createdAt
    +DateTime updatedAt
  }

  class Issue {
    +String id
    +String repoId
    +String branchId
    +String title
    +String description
    +String status
    +String createdBy
    +DateTime createdAt
    +DateTime updatedAt
  }

  class WikiPage {
    +String id
    +String repoId
    +String slug
    +String title
    +String body
    +DateTime updatedAt
  }

  class ApiKey {
    +String id
    +String repoId
    +String workspaceId
    +String keyHash
    +String name
    +DateTime createdAt
  }

  User "1" --> "0..1" UserPreferences : has
  User "1" --> "*" Workspace : created
  Workspace "*" --> "*" User : members
  Workspace "1" --> "*" Repository : contains
  Repository "*" --> "*" User : members
  Repository "1" --> "*" Branch : has
  Repository "1" --> "*" Commit : has
  Repository "1" --> "*" Tag : has
  Repository "1" --> "*" MergeRequest : has
  Repository "1" --> "*" Issue : has
  Repository "1" --> "*" WikiPage : has
  Repository "0..1" --> "*" ApiKey : has
  Workspace "0..1" --> "*" ApiKey : has

  Commit "1" --> "*" CommitTree : tree
  Commit "0..1" --> "0..1" Commit : parent
  Branch "1" --> "0..1" Commit : head
  User "1" --> "*" Commit : author
  MergeRequest "1" --> "1" Branch : source
  MergeRequest "1" --> "1" Branch : target
  MergeRequest "0..1" --> "0..1" Commit : mergeCommit
  User "1" --> "*" MergeRequest : author
  Issue "1" --> "1" Branch : branch
  User "1" --> "*" Issue : author
  Tag "1" --> "1" Commit : points to
```

---

## API services and routes (simplified)

```mermaid
classDiagram
  direction TB
  class AuthRoutes {
    POST /register
    POST /login
    POST /logout
    GET/POST /saml/*
  }

  class UsersRoutes {
    GET/PATCH /me
    POST /me/change-password
    GET/PATCH /me/preferences
  }

  class WorkspacesRoutes {
    GET/POST /workspaces
    GET/PATCH/DELETE /workspaces/:id
    GET/POST /workspaces/:id/repos
  }

  class ReposRoutes {
    GET /repos/:id
    GET /repos/:id/tree
    GET /repos/:id/files
    PATCH/DELETE /repos/:id
    GET/POST/DELETE /repos/:id/members
  }

  class VcsRoutes {
    GET/POST /repos/:id/commits
    GET/POST/DELETE/PATCH /repos/:id/branches
    GET /repos/:id/compare
    GET/POST/DELETE /repos/:id/tags
  }

  class ExecuteRoutes {
    POST /execute
  }

  class SimulateRoutes {
    POST /simulate
  }

  class UserService {
    createUser()
    findUserByEmail()
    findUserById()
    updateUserProfile()
    updateUserPassword()
    verifyPassword()
  }

  class WorkspaceService {
    listWorkspacesForUser()
    getWorkspaceById()
    getWorkspaceRole()
    createWorkspace()
    updateWorkspace()
    deleteWorkspace()
  }

  class RepoService {
    createRepository()
    getRepositoryById()
    listRepositoriesByWorkspace()
    updateRepository()
    deleteRepository()
    getRepoRole()
    addRepoMember()
    removeRepoMember()
  }

  class VcsService {
    getBranchByName()
    getBranchById()
    createBranch()
    createCommit()
    setBranchHead()
    getTreeEntries()
    insertTreeEntries()
    listBranches()
    getCommitById()
    resolveToCommitId()
    listCommits()
  }

  class TreeService {
    getTreeForBranch()
    getFileContent()
  }

  class BlobService {
    computeBlobId()
    putBlob()
    getBlob()
  }

  AuthRoutes --> UserService : uses
  UsersRoutes --> UserService : uses
  WorkspacesRoutes --> WorkspaceService : uses
  WorkspacesRoutes --> RepoService : uses
  ReposRoutes --> RepoService : uses
  ReposRoutes --> TreeService : uses
  VcsRoutes --> VcsService : uses
  VcsRoutes --> BlobService : uses
  ExecuteRoutes --> TreeService : uses
  ExecuteRoutes --> RepoService : uses
  TreeService --> VcsService : uses
  TreeService --> BlobService : uses
  RepoService --> VcsService : uses
```

---

## Middleware and auth flow

```mermaid
classDiagram
  class AuthMiddleware {
    requireAuth(req, res, next)
    requireSuperAdmin(req, res, next)
    requireWorkspaceAdmin(req, res, next)
    requireRepoRole(minRole)(req, res, next)
  }

  class Passport {
    initialize()
    session()
    authenticate(strategy)
  }

  class SessionStore {
    RedisStore | MemoryStore
  }

  AuthMiddleware --> Passport : checks req.user
  AuthMiddleware --> WorkspaceService : getWorkspaceRole
  AuthMiddleware --> RepoService : getRepositoryById, getRepoRole
  Passport --> SessionStore : session
```

---

## Frontend (high-level components)

```mermaid
classDiagram
  direction TB
  class App {
    Routes
    ProtectedRoute
    ThemeProviderWithPrefs
  }

  class AuthContext {
    user
    loading
    login/logout
  }

  class Layout {
    sidebar
    workspace/repo nav
    outlet
  }

  class Dashboard {
    workspaces list
    repos list
    apiFetch /workspaces, /repos
  }

  class RepoPage {
    tabs: Code, Issues, Branches, PR, Wiki, Settings
    repo meta from /repos/:id
  }

  class CodeTab {
    branch selector
    file tree
    editor (JDM / raw JSON)
    GraphSimulator
    commit dialog
    apiFetch: tree, files, commits, branches
    fetch: /simulate
  }

  class JdmConfigProvider {
    theme
    config
  }

  class DecisionGraph {
    nodes, edges
    JDM schema
  }

  class GraphSimulator {
    onRun(graph, context)
    POST /simulate
  }

  App --> AuthContext : uses
  App --> Layout : wraps protected routes
  Layout --> Dashboard : index
  Layout --> RepoPage : repos/:repoId/*
  RepoPage --> CodeTab : Code tab
  CodeTab --> JdmConfigProvider : wraps
  CodeTab --> DecisionGraph : editor
  CodeTab --> GraphSimulator : panel
  CodeTab --> apiFetch : API
```

---

## Execute flow (ZenEngine)

```mermaid
classDiagram
  direction LR
  class ExecuteRoute {
    POST /execute
    validateApiKey()
    load index.json
    build loader(key -> key.json)
  }

  class ZenEngine {
    createDecision(graph)
    evaluate(context)
  }

  class TreeService {
    getFileContent(repoId, branch, path)
  }

  class BlobService {
    getBlob(repoId, blobId)
  }

  ExecuteRoute --> TreeService : getFileContent
  ExecuteRoute --> ZenEngine : createDecision, evaluate
  ZenEngine ..> TreeService : loader calls getFileContent
  TreeService --> BlobService : getBlob
```

---

## Diagram index

| Diagram | Description |
|---------|-------------|
| Domain & data model | Prisma entities and relationships (User, Workspace, Repository, Commit, Branch, etc.). |
| API services and routes | Express routers and service modules (auth, users, workspaces, repos, vcs, execute, simulate). |
| Middleware and auth | requireAuth, requireRepoRole, Passport, session store. |
| Frontend | App, AuthContext, Layout, Dashboard, RepoPage, CodeTab, JDM editor, Simulator. |
| Execute flow | Execute route, ZenEngine, TreeService, BlobService. |

To view Mermaid diagrams, use a Markdown viewer that supports Mermaid (e.g. GitHub, GitLab, VS Code with Mermaid extension, or [mermaid.live](https://mermaid.live)).
