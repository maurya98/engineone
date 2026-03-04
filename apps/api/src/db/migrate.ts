import { pool } from './pool.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaDir = join(__dirname, 'schema');

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    const files = ['001_users.sql', '002_workspaces_repos.sql', '003_branches_commits_tree.sql', '004_tags_webhooks.sql', '005_mr_issues_wiki.sql', '006_api_keys.sql'];
    for (const f of files) {
      const sql = readFileSync(join(schemaDir, f), 'utf-8');
      await client.query(sql);
    }
  } finally {
    client.release();
  }
}
