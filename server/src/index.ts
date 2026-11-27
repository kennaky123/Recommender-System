import { ServerApplication } from './app/ServerApplication';

const server = new ServerApplication();

server.start().catch((err) => {
  console.error('[SPACE-X VOD API] Fatal startup error:', err);
  process.exit(1);
});
