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
