# Road Guard production security and deployment

This repository is prepared for a Vercel frontend, a Render Python API, a Render Spring organization API, and Neon PostgreSQL. Configure the platforms with environment variables; do not put production secrets in Git.

## Render

The supplied production frontend is `https://flipkart-xi-blue.vercel.app` and the supplied Render API is `https://flipkart-06iz.onrender.com`.

Deploy the root `render.yaml` blueprint. It defines the Spring service from `roadguard-admin/backend/Dockerfile` and the Python API. Set the prompted values in Render:

- Python service `DATABASE_URL`: Neon pooled connection string, with `sslmode=require`.
- Python service `SPRING_API_BASE_URL`: the HTTPS URL of `road-guard-org-api` (or its Render private `.render.internal` address when using Render private networking).
- Spring service `ROADGUARD_PYTHON_API_BASE_URL`: the Python API origin used by Spring's issue/map/Chitti proxy. The Blueprint sets this to `https://flipkart-06iz.onrender.com`; change it if the Python API hostname changes.
- Python service `CORS_ALLOWED_ORIGINS`: `https://flipkart-xi-blue.vercel.app` (add any custom frontend domain as another comma-separated origin).
- Python service `TRUSTED_HOSTS`: `flipkart-06iz.onrender.com` (add any custom API hostname if used).
- Python service `GOOGLE_MAPS_API_KEY`, `GEMINI_API_KEY`, `MAIL_USERNAME`, and `MAIL_PASSWORD`: add only the provider keys the deployed features need.
- Spring service `SPRING_DATASOURCE_URL`: JDBC Neon URL, e.g. `jdbc:postgresql://HOST/DB?sslmode=require`.
- Spring service `SPRING_DATASOURCE_USERNAME` and `SPRING_DATASOURCE_PASSWORD`: the Neon database role credentials.
- Spring service `APP_CORS_ALLOWED_ORIGINS`: exact frontend origins only if the browser calls Spring directly. Normal frontend API requests should use the Vercel rewrite to the Python API.
- Spring service `APP_JWT_SECRET`: a random base64-encoded value of at least 32 bytes (for example, generate one with `openssl rand -base64 32`). Keep it only in Render environment variables. If omitted, the service generates an in-memory key and restarts invalidate current sign-ins.
- Mail credentials are optional environment variables (`MAIL_USERNAME`, `MAIL_PASSWORD`).
- Spring service `GOOGLE_CLIENT_ID`: required only when Google sign-in is enabled.
- The Spring service health check is `/actuator/health`; it is public and returns health status without component details.

Render private service networking requires a paid plan. If the Spring service is public, keep it HTTPS-only and retain its authenticated routes. Do not expose PostgreSQL publicly; Neon should require TLS and use a dedicated, least-privilege application role.

## Vercel

Set the Vercel project root to the repository root so it reads `vercel.json`. Its external rewrites send `/api/*` and `/auth/*` to `https://flipkart-06iz.onrender.com` while browser requests remain same-origin. If Render assigns your Python service a different hostname or you use a custom API domain, update both rewrite destinations in `vercel.json`.

Keep the Vercel frontend and API on HTTPS. Add each production frontend origin to the Render CORS lists only if making direct cross-origin API calls; never use `*`.

## Database and secret handling

- Set the same Neon database in both Render services using the respective URL formats above. Never commit `.env`, passwords, Google/Gemini keys, signing secrets, or database URLs.
- `.gitignore` now excludes environment files, virtual environments, logs, build output, and dependency directories. Git ignore does not remove a secret that was committed in the past. If any real key or password has ever been pushed, rotate it at its provider and remove it from repository history before making the repository public.
- The Spring application no longer prints SQL or lets Hibernate change the production schema automatically. Apply reviewed schema migrations explicitly before deployment.
- Database queries found in the Python issue store use psycopg bound parameters; Spring repositories/JdbcTemplate should likewise keep user values parameterized. Do not build SQL strings from user input.

## Before going live

1. Confirm Render and Vercel environment variables are set; never copy secret values into chat, source files, or build-time `VITE_*` variables.
2. Set exact allowed origins and trusted hosts, then verify sign-in, reporting, maps, admin issue actions, employee task actions, password reset, and email delivery in staging.
3. Configure provider-side rate limits/WAF for sign-in, OTP, report submission, uploads, and AI endpoints. The app includes basic in-process limits for sign-in, OTP, and bug reports; these reset on service restart and do not replace provider-side limits. The app-level request-size limit is 50 MiB; tune it only if the product needs larger video uploads.
4. Enable MFA for Vercel, Render, and Neon accounts; restrict Neon IP/network access where supported; use a dedicated DB role and rotate credentials.
5. Review any external map/AI/email key restrictions and billing limits. Keep Google browser keys referrer-restricted and server keys restricted to only the APIs they use.

These controls reduce common deployment risks; they do not make a public service invulnerable. Keep dependencies and platform runtimes updated and review provider security alerts.
