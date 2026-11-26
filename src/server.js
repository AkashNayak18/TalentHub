import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const { server, ready } = createApp(config);

if (config.secretKey.startsWith('dev-only')) {
  console.warn('WARNING: using the default SECRET_KEY - set SECRET_KEY before deploying.');
}

await ready;
server.listen(config.port, () => {
  console.log(`TalentHub running at http://127.0.0.1:${config.port}/  (database: ${config.databasePath})`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
