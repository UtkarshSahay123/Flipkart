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

## Reproduction and follow-up fix (2026-10-19)

- During a follow-up check, Python `/health` and `/api/stats` returned HTTP 200 while Spring `/actuator/health` timed out after 35 seconds. A later health check returned HTTP 200, and deliberately invalid login probes returned the expected HTTP 401 directly through Spring, through the Python proxy, and through Vercel. This reproduces the intermittent Spring availability pattern in the supplied Uvicorn logs.
- The sign-in page now polls the Spring readiness endpoint through the Python API for up to two minutes before sending credentials. This prevents cold-start 502s from consuming the user's login attempts; if Spring does not become ready in that window, the page shows a short startup message.
- The Python auth proxy now logs upstream 5xx responses and connection failures with the operation and elapsed time, without logging credentials or request bodies. This makes the next failure attributable in the Python service's Render logs.
- The readiness route uses a 12-second upstream timeout per poll so a cold or unreachable Spring instance does not leave repeated proxy requests hanging for the full login timeout.

The live checks confirm the services recover when Spring is available. They cannot verify a real account sign-in, and the cold-start path must be checked after these code changes are deployed. An always-on Spring plan is still required to eliminate Render cold starts entirely.

### Follow-up from browser capture

- The new sign-in page is deployed and polling `/api/auth/ready`, but the screenshot still shows failed readiness requests. A live check at that time found Python `/health` returning HTTP 200 while Spring `/actuator/health` timed out after 25 seconds.
- That probe also exposed a Python proxy edge case: a socket timeout could escape the `URLError` handler and surface as HTTP 500. The auth proxy now catches timeout and socket errors too, logs the failure, and returns a retryable HTTP 503 from readiness (login requests get 502).
- This makes the readiness polling report and retry upstream timeouts correctly. It cannot recover if the Spring service itself does not start or become reachable; persistent Spring health timeouts need the Spring service's Render logs and deployment status.
