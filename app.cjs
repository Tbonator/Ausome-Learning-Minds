// cPanel / Passenger startup file. Keep the application root private.
import('./server/index.mjs').catch(() => {
  console.error('Application startup failed. Check the private server configuration and error logs.');
  process.exit(1);
});
