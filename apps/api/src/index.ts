import { createApp } from './app';
import { config } from './config';
import { seedSuperadmin } from './db/seed';

async function main() {
  await seedSuperadmin();
  const app = await createApp();
  app.listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
