# Login Outage Checkup

Date: 2026-10-19

## Findings

- `https://flipkart-06iz.onrender.com/health` returned HTTP 200 while the login service was unavailable. This health check confirms the Python API process is alive; it does not confirm that the Spring authentication service is ready.
- `https://flipkart-springboot-webservice.onrender.com/actuator/health` timed out during the initial check. A later request returned HTTP 200 after approximately 78 seconds.
- Once Spring was ready, a deliberately invalid login returned HTTP 401 from Spring directly, from the Python API proxy, and through the Vercel route. HTTP 401 is expected for the probe account and confirms all three routes reached the authentication application.
- The supplied browser capture shows the Python API returning repeated HTTP 502 responses in under two seconds. The browser retry budget in the previous release was shorter than the observed Spring startup delay.
- The `/favicon.ico` 404 in the browser capture is unrelated to authentication.

## Cause

The Python API can be healthy while the Spring authentication service has no ready instance. During Spring startup, `/api/auth/login` receives an upstream 502. Once Spring becomes ready, the same proxy path reaches authentication normally. This is consistent with a slow Render cold start; Render documents that Free web services spin down after 15 minutes idle and can take about a minute to wake. The live check observed about 78 seconds before Spring health responded.

The Render dashboard and service plan are not accessible from this repository workspace, so the service's plan and startup logs could not be inspected.

## Changes pushed

- Sign-in now retries HTTP 5xx responses over a bounded window of about 105 seconds, covering the observed cold-start time.
- The button says the backend may take up to two minutes to wake.
- Sign-in errors show a short backend availability message instead of rendering a large HTML gateway page.
- The Python auth proxy replaces upstream 5xx HTML pages with a compact JSON error, avoiding repeated 164 KB gateway responses during retries.
- `render.yaml` points `SPRING_API_BASE_URL` to `https://flipkart-springboot-webservice.onrender.com`.

## Verification

- Production build: passed.
- Live Python health: HTTP 200.
- Live Spring health: HTTP 200 after the slow startup.
- Fake-account login probes after startup: HTTP 401 through Spring, the Python API, and Vercel. No real credentials were used.

## Availability limitation

Retries make a cold start recover without asking the user to resubmit immediately, but code cannot keep a Render Free instance awake when Render spins it down. To remove cold-start delays, set the Spring authentication service to an always-on Render plan. That change can incur charges and must be made in the Render dashboard; it was not applied from this workspace.

Reference: [Render Free web service behavior](https://render.com/docs/free).

## Follow-up live check (2026-10-19 08:01 IST)

- Python `/health`: HTTP 200 (0.42 seconds).
- Spring `/actuator/health`: HTTP 200 (0.61 seconds).
- Spring `/api/auth/login`, Python `/api/auth/login`, and Vercel `/api/auth/login`: HTTP 401 for a deliberately invalid probe account (all under 0.8 seconds). This is the expected authentication response and confirms that the login request currently reaches Spring through both routes. No real credentials were used.
- Python `/api/stats`: HTTP 200 (0.96 seconds).
- These checks were made while the services were warm. They confirm the current routes work; they do not rule out intermittent failures during a cold start or a database/startup problem.

## Render logs access

The public service URLs do not expose Render's private service logs, and no Render dashboard/API credentials are configured in this workspace. To identify a future 502 precisely, inspect both services in the Render Dashboard around the failure time:

1. `flipkart-06iz` (Python API): check the request and response for `POST /api/auth/login`, including the upstream response or connection failure.
2. `flipkart-springboot-webservice` (Spring API): check startup/readiness, database connection or pool errors, and the matching `POST /api/auth/login` request.

The historical Uvicorn lines only prove the Python API returned 502; they do not include the Spring service's reason. If both services are healthy and the request still fails, the Spring service log at that exact timestamp is needed to distinguish a database/auth exception from a Render startup or routing failure.

## Follow-up reproduction and mitigation (2026-10-20)

- The supplied browser console shows `GET /api/auth/ready` failing repeatedly with HTTP 502. These are small readiness GETs with no login payload, so splitting login packets cannot address this failure.
- A live check found the Python API `/health` returning HTTP 200, its `/api/auth/ready` returning HTTP 502 in about 0.43 seconds, and the Spring `/actuator/health` endpoint timing out after 30 seconds. This confirms the failure is at the Spring dependency/readiness hop, not the browser or the size of the sign-in request. The short proxy 502 and the direct timeout can reflect different states while the Render service is starting; Render logs are needed to identify whether it is sleeping, restarting, or exhausting memory.
- The earlier supplied Spring log did report `java.lang.OutOfMemoryError: Java heap space`, so limited memory is a credible risk, but this capture alone does not prove that the current 502 is caused by RAM. The browser's Permissions-Policy warnings are unrelated.
- Sign-in readiness polling now allows up to three minutes, starts with a three-second interval, and backs off to at most 15 seconds. Each individual probe has a 25-second abort/connection timeout. This gives Render's documented cold-start window time to complete while avoiding a probe every five seconds throughout an outage.
- Packet chunking was rejected: the readiness check sends no body, and login credentials are already a small JSON request. The safer operational choices are to keep Spring warm on a paid plan, or reduce its memory use and inspect/reduce high-allocation workloads; an upgrade is the dependable fix for both cold starts and a hard 512 MB limit. No plan change can be made from this repository.
- Before selecting a JVM heap increase, inspect the Spring service's current Render plan and memory metrics. Its Docker image caps heap at 45% of detected RAM; raising that cap on a 512 MB instance may trade Java heap OOMs for a container-level OOM, so it should not be changed without measurements.

## Reproduction and follow-up fix (2026-10-19)

- During a follow-up check, Python `/health` and `/api/stats` returned HTTP 200 while Spring `/actuator/health` timed out after 35 seconds. A later health check returned HTTP 200, and deliberately invalid login probes returned the expected HTTP 401 directly through Spring, through the Python proxy, and through Vercel. This reproduces the intermittent Spring availability pattern in the supplied Uvicorn logs.
- The sign-in page now polls the Spring readiness endpoint through the Python API for up to two minutes before sending credentials. This prevents cold-start 502s from consuming the user's login attempts; if Spring does not become ready in that window, the page shows a short startup message.
- The Python auth proxy now logs upstream 5xx responses and connection failures with the operation and elapsed time, without logging credentials or request bodies. This makes the next failure attributable in the Python service's Render logs.
- The readiness route uses a 12-second upstream timeout per poll so a cold or unreachable Spring instance does not leave repeated proxy requests hanging for the full login timeout.

The live checks confirm the services recover when Spring is available. They cannot verify a real account sign-in, and the cold-start path must be checked after these code changes are deployed. An always-on Spring plan is still required to eliminate Render cold starts entirely.

## Spring heap exhaustion (2026-10-19)

- The supplied Spring log identifies the immediate failure: `java.lang.OutOfMemoryError: Java heap space`. This explains why the employee portal can receive gateway errors while separate lightweight endpoints continue responding.
- The employee dashboard was polling several endpoints every five seconds. Those endpoints loaded complete account entities, including base64 profile images, and task entities eagerly loaded complete assigned employee records. The task status endpoint then limited results in application memory after fetching them.
- Employee dashboard polling is now every 30 seconds. Dashboard task reads use bounded SQL projections with a 500-row cap and select only display fields, avoiding eager account/profile-image materialization. Organization and department member lists also select only fields needed by the page. The subordinate list uses a recursive SQL query instead of loading every account and checking each manager chain in application code.
- The scheduled reminder service now reads compact recipient fields directly from SQL instead of hydrating full account entities and their profile images.
- Verification: a clean Maven compile and Vite production build both passed. The frontend build reports its existing large-chunk advisory. No production Render JVM metrics or heap dump were available, so this addresses the identified high-allocation paths but does not prove the service will never exhaust heap under larger traffic or data volumes. The Java heap percentage was left unchanged because the service's Render memory tier is not available from this workspace.

## Employee task assignment 401 investigation (2026-10-19)

- The employee UI only shows the assignment form for a department head. The Spring endpoint also checks that role and returns HTTP 403 if the caller is not a head. The reported HTTP 401 occurs earlier in Spring Security, so it indicates the Bearer token was not accepted rather than a task/member validation failure.
- `AccessTokenService` previously generated a random process-local JWT key whenever `APP_JWT_SECRET` was unset, allowing sign-in to work but invalidating tokens after a restart and making them inconsistent across instances. This fits the observed pattern where an already-open dashboard can load data and later receive 401 on a mutation.
- The Render Blueprint now declares `APP_JWT_SECRET` as a generated, persistent secret and marks the Spring service as production. Java now fails clearly at startup if the production secret is missing instead of serving transient tokens that break later requests.
- Render documents that `generateValue: true` creates a persistent random base64 256-bit secret and does not replace an already-existing value. The Blueprint must be synced for this environment configuration to take effect: [Render environment variables](https://render.com/docs/configure-environment-variables).

## Employee dashboard gateway error display (2026-10-19)

- The supplied Uvicorn logs show `/api/portal/me` and the employee's department data requests returning HTTP 502 while `/api/stats` returns 200. A live check also found Python `/health` at HTTP 200 while Spring `/actuator/health` returned HTTP 503, confirming the portal's Spring dependency was unhealthy at the time.
- The portal proxy now replaces upstream HTML 5xx pages and connection timeouts with a compact JSON message and logs the upstream status/path without exposing response HTML.
- `portalApi` now sanitizes any HTML or other 5xx response, so gateway markup cannot be rendered as an error message.
- If the initial employee profile cannot load, the dashboard now shows a clear unavailable message with Retry and Sign out controls rather than presenting an empty dashboard with misleading zero counts. Existing automatic refresh continues to retry in the background.

### Follow-up from browser capture

- The new sign-in page is deployed and polling `/api/auth/ready`, but the screenshot still shows failed readiness requests. A live check at that time found Python `/health` returning HTTP 200 while Spring `/actuator/health` timed out after 25 seconds.
- That probe also exposed a Python proxy edge case: a socket timeout could escape the `URLError` handler and surface as HTTP 500. The auth proxy now catches timeout and socket errors too, logs the failure, and returns a retryable HTTP 503 from readiness (login requests get 502).
- This makes the readiness polling report and retry upstream timeouts correctly. It cannot recover if the Spring service itself does not start or become reachable; persistent Spring health timeouts need the Spring service's Render logs and deployment status.
- After Spring recovered, `/api/auth/ready` returned HTTP 200 with readiness `UP`; deliberately invalid login probes returned the expected HTTP 401 directly through Spring, through the Python proxy, and through Vercel. This confirms the deployed readiness path and proxy are functioning while Spring is available. No real account credentials were used.
