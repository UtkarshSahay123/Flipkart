# Road Guard installable web app

This folder contains the separate installable PWA shell. It opens the existing Road Guard website in a same-origin frame, so current sign-in, routes, API operations, and Neon-backed data remain in the existing application. It does not create or migrate a second database.

The FastAPI service exposes the shell at `/webapp/`. Run the normal Road Guard server and visit `http://localhost:8001/webapp/`. For production installation, serve the app over HTTPS.

The service worker caches only the PWA shell. It bypasses API and authentication requests; live reports, sign-in, maps, and dashboard data continue to use the existing backend.
