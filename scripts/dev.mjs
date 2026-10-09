// Start the Next dev server in-process on hosts that restrict child processes.
process.env.NODE_ENV = 'development';
process.env.__NEXT_DEV_SERVER = '1';
const { startServer } = await import('next/dist/server/lib/start-server.js');
await startServer({
  dir: process.cwd(),
  port: 3000,
  hostname: '127.0.0.1',
  isDev: true,
  allowRetry: false,
});
