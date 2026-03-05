-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "role" VARCHAR(50) NOT NULL DEFAULT 'user',
    "saml_id" VARCHAR(255),
    "display_name" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "user_id" UUID NOT NULL,
    "theme" VARCHAR(50) NOT NULL DEFAULT 'system',
    "font_size" VARCHAR(50) NOT NULL DEFAULT 'medium',
    "font_style" VARCHAR(100) NOT NULL DEFAULT 'default',
    "icon_pack" VARCHAR(100) NOT NULL DEFAULT 'default',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("workspace_id","user_id")
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "default_branch_name" VARCHAR(255) NOT NULL DEFAULT 'main',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepoMember" (
    "repo_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepoMember_pkey" PRIMARY KEY ("repo_id","user_id")
);

-- CreateTable
CREATE TABLE "Commit" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "repo_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "parent_commit_id" UUID,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitTree" (
    "commit_id" UUID NOT NULL,
    "path" VARCHAR(1024) NOT NULL,
    "blob_id" VARCHAR(255) NOT NULL,
    "kind" VARCHAR(20) NOT NULL,

    CONSTRAINT "CommitTree_pkey" PRIMARY KEY ("commit_id","path")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "repo_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "head_commit_id" UUID,
    "is_protected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "repo_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "commit_id" UUID NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepoWebhook" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "repo_id" UUID NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "events" VARCHAR(255) NOT NULL DEFAULT 'push',
    "secret" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepoWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MergeRequest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "repo_id" UUID NOT NULL,
    "source_branch_id" UUID NOT NULL,
    "target_branch_id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'open',
    "author_id" UUID NOT NULL,
    "merge_commit_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MergeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MergeRequestWatcher" (
    "merge_request_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MergeRequestWatcher_pkey" PRIMARY KEY ("merge_request_id","user_id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "repo_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'open',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiPage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "repo_id" UUID NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "body" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WikiPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "repo_id" UUID,
    "workspace_id" UUID,
    "key_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_saml_id_idx" ON "User"("saml_id");

-- CreateIndex
CREATE INDEX "Workspace_created_by_idx" ON "Workspace"("created_by");

-- CreateIndex
CREATE INDEX "WorkspaceMember_user_id_idx" ON "WorkspaceMember"("user_id");

-- CreateIndex
CREATE INDEX "Repository_workspace_id_idx" ON "Repository"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_workspace_id_name_key" ON "Repository"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "RepoMember_user_id_idx" ON "RepoMember"("user_id");

-- CreateIndex
CREATE INDEX "CommitTree_commit_id_idx" ON "CommitTree"("commit_id");

-- CreateIndex
CREATE INDEX "Tag_repo_id_idx" ON "Tag"("repo_id");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_repo_id_name_key" ON "Tag"("repo_id", "name");

-- CreateIndex
CREATE INDEX "RepoWebhook_repo_id_idx" ON "RepoWebhook"("repo_id");

-- CreateIndex
CREATE INDEX "MergeRequest_repo_id_idx" ON "MergeRequest"("repo_id");

-- CreateIndex
CREATE INDEX "Issue_repo_id_idx" ON "Issue"("repo_id");

-- CreateIndex
CREATE INDEX "Issue_branch_id_idx" ON "Issue"("branch_id");

-- CreateIndex
CREATE INDEX "WikiPage_repo_id_idx" ON "WikiPage"("repo_id");

-- CreateIndex
CREATE UNIQUE INDEX "WikiPage_repo_id_slug_key" ON "WikiPage"("repo_id", "slug");

-- CreateIndex
CREATE INDEX "ApiKey_repo_id_idx" ON "ApiKey"("repo_id");

-- CreateIndex
CREATE INDEX "ApiKey_workspace_id_idx" ON "ApiKey"("workspace_id");

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepoMember" ADD CONSTRAINT "RepoMember_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepoMember" ADD CONSTRAINT "RepoMember_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commit" ADD CONSTRAINT "Commit_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commit" ADD CONSTRAINT "Commit_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commit" ADD CONSTRAINT "Commit_parent_commit_id_fkey" FOREIGN KEY ("parent_commit_id") REFERENCES "Commit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitTree" ADD CONSTRAINT "CommitTree_commit_id_fkey" FOREIGN KEY ("commit_id") REFERENCES "Commit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_head_commit_id_fkey" FOREIGN KEY ("head_commit_id") REFERENCES "Commit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_commit_id_fkey" FOREIGN KEY ("commit_id") REFERENCES "Commit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepoWebhook" ADD CONSTRAINT "RepoWebhook_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeRequest" ADD CONSTRAINT "MergeRequest_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeRequest" ADD CONSTRAINT "MergeRequest_source_branch_id_fkey" FOREIGN KEY ("source_branch_id") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeRequest" ADD CONSTRAINT "MergeRequest_target_branch_id_fkey" FOREIGN KEY ("target_branch_id") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeRequest" ADD CONSTRAINT "MergeRequest_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeRequest" ADD CONSTRAINT "MergeRequest_merge_commit_id_fkey" FOREIGN KEY ("merge_commit_id") REFERENCES "Commit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeRequestWatcher" ADD CONSTRAINT "MergeRequestWatcher_merge_request_id_fkey" FOREIGN KEY ("merge_request_id") REFERENCES "MergeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeRequestWatcher" ADD CONSTRAINT "MergeRequestWatcher_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPage" ADD CONSTRAINT "WikiPage_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
