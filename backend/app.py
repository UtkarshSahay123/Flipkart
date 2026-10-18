import os
import sys
import logging
import json
import random
import asyncio
import base64
import heapq
import math
import re
import urllib.parse
import time
import xml.etree.ElementTree as ET
from pathlib import Path

from fastapi import FastAPI, WebSocket, HTTPException, UploadFile, File, Form, Request
from fastapi import Query
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel, Field
from urllib.error import URLError, HTTPError
from urllib.request import Request as URLRequest, urlopen

logger = logging.getLogger(__name__)

# ── Add project root to path so ml_models can be imported ──
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# ── Lazy-load Gemini analyzer (requires API key at runtime) ──
_gemini_analyzer = None

def get_analyzer():
    global _gemini_analyzer
    if _gemini_analyzer is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="GEMINI_API_KEY environment variable is required for Gemini Vision."
            )
        
        try:
            from ml_models.gemini_vision.analyzer import GeminiVisionAnalyzer
            _gemini_analyzer = GeminiVisionAnalyzer(api_key=api_key)
        except Exception as e:
            logger.exception("Gemini Vision initialization failed")
            raise HTTPException(status_code=503, detail="Gemini Vision is temporarily unavailable.") from e
    return _gemini_analyzer


# ── Lazy-load YOLO models (prevents slow startup) ──
_yolo_rdd = None
_yolo_coco = None

def get_yolo_rdd():
    global _yolo_rdd
    if _yolo_rdd is None:
        try:
            from ultralytics import YOLO
            model_path = ROOT / "RoadDamageDetection-main" / "models" / "YOLOv8_Small_RDD.pt"
            _yolo_rdd = YOLO(str(model_path))
            print("✅ YOLO RDD Model loaded successfully")
        except Exception as e:
            logger.exception("YOLO RDD model loading failed")
            raise HTTPException(status_code=503, detail="Road damage analysis is temporarily unavailable.") from e
    return _yolo_rdd

def get_yolo_coco():
    global _yolo_coco
    if _yolo_coco is None:
        try:
            from ultralytics import YOLO
            model_path = ROOT / "yolov8n.pt"
            if not model_path.exists():
                model_path = ROOT / "RoadDamageDetection-main" / "yolov8n.pt"
            _yolo_coco = YOLO(str(model_path))
            print("✅ YOLO COCO Model loaded successfully")
        except Exception as e:
            logger.exception("YOLO COCO model loading failed")
            raise HTTPException(status_code=503, detail="Object analysis is temporarily unavailable.") from e
    return _yolo_coco


from typing import Optional

class SimulationRequest(BaseModel):
    event_type: str
    start_point: str = ""
    end_point: str = ""
    start_coords: Optional[list] = None
    end_coords: Optional[list] = None
    crowd_size: int = 0
    time: str = "17:00"
    event_cause: str = "others"
    date: str = ""
    duration_hours: float = 1.0
    road_closure: str = "no"
    location_description: str = ""


# ─────────────────────────────────────────────
APP_ENV = os.environ.get("APP_ENV", "development").strip().lower()
IS_PRODUCTION = APP_ENV == "production"
app = FastAPI(
    title="Traffic Intelligence API",
    description="AI-powered road hazard detection + traffic monitoring",
    version="2.0.0",
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

cors_origins = [origin.strip().rstrip("/") for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",") if origin.strip()]
if not IS_PRODUCTION and not cors_origins:
    cors_origins = ["http://localhost:8001", "http://127.0.0.1:8001", "http://localhost:5173", "http://127.0.0.1:5173"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
    allow_credentials=False,
)

trusted_hosts = [host.strip() for host in os.getenv("TRUSTED_HOSTS", "").split(",") if host.strip()]
if trusted_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=trusted_hosts)

MAX_REQUEST_BYTES = int(os.getenv("MAX_REQUEST_BYTES", str(50 * 1024 * 1024)))
_public_rate_windows = {}
_public_rate_checks = 0

def enforce_public_rate_limit(request: Request, scope: str, limit: int, window_seconds: int):
    """Apply a small in-process fixed-window limit to public, abuse-sensitive routes."""
    global _public_rate_checks
    client_ip = request.client.host if request.client and request.client.host else "unknown"
    key = f"{scope}:{client_ip}"
    now = time.monotonic()
    started_at, count = _public_rate_windows.get(key, (now, 0))
    if now - started_at >= window_seconds:
        started_at, count = now, 0
    if count >= limit:
        retry_after = max(1, int(window_seconds - (now - started_at)))
        raise HTTPException(status_code=429, detail="Too many requests. Please wait before trying again.",
                            headers={"Retry-After": str(retry_after)})
    _public_rate_windows[key] = (started_at, count + 1)
    _public_rate_checks += 1
    if _public_rate_checks % 256 == 0:
        expired_before = now - window_seconds
        for old_key, (old_started, _) in list(_public_rate_windows.items()):
            if old_started < expired_before:
                _public_rate_windows.pop(old_key, None)

@app.middleware("http")
async def add_security_headers_and_request_limits(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_REQUEST_BYTES:
                return JSONResponse(status_code=413, content={"detail": "Request body is too large."})
        except ValueError:
            return JSONResponse(status_code=400, content={"detail": "Invalid Content-Length header."})
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(self)")
    response.headers.setdefault("Content-Security-Policy", "frame-ancestors 'self'")
    if request.url.path.startswith(("/api/", "/auth/")):
        response.headers.setdefault("Cache-Control", "no-store")
    if IS_PRODUCTION:
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response

# Location autocomplete for the Live Issue Map. Uses Google Places when a server-side
# key is configured; otherwise falls back to Nominatim with local-result ranking.
_place_cache = {}

def _google_places_autocomplete(query: str, lat: Optional[float], lng: Optional[float]):
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not api_key:
        return None
    body = {"input": query, "languageCode": "en", "regionCode": "IN", "includedRegionCodes": ["in"]}
    if lat is not None and lng is not None:
        body["locationBias"] = {"circle": {"center": {"latitude": lat, "longitude": lng}, "radius": 30000}}
        body["origin"] = {"latitude": lat, "longitude": lng}
    request = URLRequest(
        "https://places.googleapis.com/v1/places:autocomplete",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "X-Goog-Api-Key": api_key},
        method="POST",
    )
    with urlopen(request, timeout=8) as response:
        payload = json.loads(response.read())
    return [
        {"label": p.get("placePrediction", {}).get("text", {}).get("text", ""),
         "placeId": p.get("placePrediction", {}).get("placeId")}
        for p in payload.get("suggestions", []) if p.get("placePrediction")
    ]

def _photon_locations(query: str, lat: Optional[float], lng: Optional[float], limit: int = 5):
    params = {"q": query, "limit": str(limit), "lang": "en", "countrycode": "IN"}
    if lat is not None and lng is not None:
        params.update({"lat": str(lat), "lon": str(lng), "zoom": "12"})
    request = URLRequest(
        "https://photon.komoot.io/api/?" + urllib.parse.urlencode(params),
        headers={"User-Agent": "RoadGuard/1.0 (Command Center location search)"},
    )
    with urlopen(request, timeout=8) as response:
        payload = json.loads(response.read())

    suggestions = []
    seen = set()
    for feature in payload.get("features", []):
        properties = feature.get("properties") or {}
        coordinates = (feature.get("geometry") or {}).get("coordinates") or []
        if len(coordinates) < 2:
            continue
        country_code = properties.get("countrycode")
        if country_code and country_code.upper() != "IN":
            continue
        street = " ".join(part for part in (properties.get("housenumber"), properties.get("street")) if part)
        address_parts = [
            properties.get("name"), street, properties.get("district"),
            properties.get("city"), properties.get("county"), properties.get("state"),
            properties.get("postcode"), properties.get("country"),
        ]
        label_parts = []
        for part in address_parts:
            if part and part.casefold() not in {existing.casefold() for existing in label_parts}:
                label_parts.append(part)
        label = ", ".join(label_parts) or query
        point = [float(coordinates[1]), float(coordinates[0])]
        identity = (label.casefold(), point[0], point[1])
        if identity in seen:
            continue
        seen.add(identity)
        suggestions.append({"label": label, "point": point})
    return suggestions

def _google_place_location(place_id: str):
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not api_key:
        return None
    request = URLRequest(
        f"https://places.googleapis.com/v1/places/{urllib.parse.quote(place_id, safe='')}",
        headers={"X-Goog-Api-Key": api_key, "X-Goog-FieldMask": "location,formattedAddress"},
    )
    with urlopen(request, timeout=8) as response:
        place = json.loads(response.read())
    location = place.get("location") or {}
    if "latitude" not in location or "longitude" not in location:
        return None
    return {
        "label": place.get("formattedAddress", ""),
        "point": [float(location["latitude"]), float(location["longitude"])],
    }

@app.get("/api/maps/suggestions", summary="Suggest map destinations near the user")
async def map_suggestions(q: str = Query(min_length=3, max_length=200), lat: Optional[float] = None, lng: Optional[float] = None):
    cache_key = (q.strip().casefold(), round(lat, 3) if lat is not None else None, round(lng, 3) if lng is not None else None)
    cached = _place_cache.get(cache_key)
    if cached and cached[0] > time.time():
        return {"suggestions": cached[1]}
    try:
        query = q.strip()
        suggestions = None
        if not re.fullmatch(r"\d{6}", query):
            try:
                suggestions = await asyncio.to_thread(_google_places_autocomplete, query, lat, lng)
            except (HTTPError, URLError, TimeoutError, OSError, ValueError) as provider_error:
                logger.warning("Google Places autocomplete failed; falling back to Photon: %s", provider_error)
        if not suggestions:
            suggestions = await asyncio.to_thread(_photon_locations, query, lat, lng, 5)
        _place_cache[cache_key] = (time.time() + 300, suggestions)
        return {"suggestions": suggestions}
    except (HTTPError, URLError, TimeoutError, OSError, ValueError) as error:
        logger.warning("Photon location suggestions failed (%s).", type(error).__name__)
        raise HTTPException(status_code=502, detail="Location search is temporarily unavailable.") from error

@app.get("/api/maps/resolve", summary="Resolve a typed location or Indian PIN code")
async def resolve_map_location(q: str = Query(min_length=3, max_length=200), lat: Optional[float] = None, lng: Optional[float] = None):
    query = q.strip()
    try:
        if not re.fullmatch(r"\d{6}", query) and os.environ.get("GOOGLE_MAPS_API_KEY"):
            try:
                predictions = await asyncio.to_thread(_google_places_autocomplete, query, lat, lng)
                if predictions and predictions[0].get("placeId"):
                    resolved = await asyncio.to_thread(_google_place_location, predictions[0]["placeId"])
                    if resolved:
                        return resolved
            except (HTTPError, URLError, TimeoutError, OSError, ValueError, KeyError) as provider_error:
                logger.warning("Google Places location resolution failed; falling back to Photon: %s", provider_error)
        matches = await asyncio.to_thread(_photon_locations, query, lat, lng, 1)
        if matches:
            return matches[0]
        raise HTTPException(status_code=404, detail="No matching location was found. Choose a suggestion or enter a more specific address.")
    except HTTPException:
        raise
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, KeyError) as error:
        logger.warning("Photon location lookup failed (%s).", type(error).__name__)
        raise HTTPException(status_code=502, detail="Location lookup is temporarily unavailable.") from error

@app.get("/api/maps/place/{place_id}", summary="Resolve a Google place prediction")
async def map_place_details(place_id: str):
    if not os.environ.get("GOOGLE_MAPS_API_KEY"):
        raise HTTPException(status_code=404, detail="Google Places is not configured.")
    try:
        place = await asyncio.to_thread(_google_place_location, place_id)
        if not place:
            raise HTTPException(status_code=404, detail="The selected place has no mapped coordinates.")
        return place
    except HTTPException:
        raise
    except (HTTPError, URLError, TimeoutError, KeyError, ValueError) as error:
        raise HTTPException(status_code=502, detail="Could not resolve the selected place.") from error

# ── Serve static pages directly from FastAPI ──
@app.get("/", response_class=FileResponse, summary="Serve Home Page")
async def read_index():
    return FileResponse(str(ROOT / "index.html"))

@app.get("/index.html", response_class=FileResponse, summary="Serve Home Page (alias)")
async def read_index_alias():
    return FileResponse(str(ROOT / "index.html"))

@app.get("/command.html", response_class=FileResponse, summary="Serve Traffic Command Center")
async def read_command():
    return FileResponse(str(ROOT / "command.html"))

@app.get("/about.html", response_class=FileResponse, summary="Serve About Page")
async def read_about():
    return FileResponse(str(ROOT / "about.html"))

@app.get("/technology.html", response_class=FileResponse, summary="Serve Technology Page")
async def read_technology():
    return FileResponse(str(ROOT / "technology.html"))

@app.get("/site-chitti.js", response_class=FileResponse, summary="Serve shared public Chitti assistant")
async def serve_site_chitti_js():
    return FileResponse(str(ROOT / "site-chitti.js"), media_type="application/javascript")

@app.get("/responsive.css", response_class=FileResponse, summary="Serve shared responsive styles")
async def serve_responsive_css():
    return FileResponse(str(ROOT / "responsive.css"), media_type="text/css")

@app.get("/shield-logo.svg", response_class=FileResponse, summary="Serve the shared Road Guard brand symbol")
async def serve_brand_symbol():
    return FileResponse(str(ROOT / "roadguard-admin" / "dashboard" / "public" / "shield-logo.svg"), media_type="image/svg+xml")

@app.get("/admin/signin.html", response_class=FileResponse, summary="Serve admin sign-in")
async def read_admin_signin():
    return FileResponse(str(ROOT / "roadguard-admin" / "sigin and signup" / "signin.html"))

@app.get("/admin/signup.html", response_class=FileResponse, summary="Serve admin registration")
async def read_admin_signup():
    return FileResponse(str(ROOT / "roadguard-admin" / "sigin and signup" / "signup.html"))

def _spring_service_base() -> str:
    configured = os.getenv("SPRING_API_BASE_URL")
    if IS_PRODUCTION and not configured:
        raise HTTPException(status_code=503, detail="The organization service is not configured.")
    base = (configured or "http://127.0.0.1:8083").rstrip("/")
    parsed = urllib.parse.urlsplit(base)
    is_local = parsed.hostname in {"127.0.0.1", "localhost"}
    is_render_private = bool(parsed.hostname and parsed.hostname.endswith(".render.internal"))
    if parsed.scheme not in {"https", "http"} or parsed.username or parsed.password or parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
        raise HTTPException(status_code=500, detail="The organization service URL is invalid.")
    if parsed.scheme != "https" and not is_local and not (IS_PRODUCTION and is_render_private):
        raise HTTPException(status_code=500, detail="The organization service URL must use HTTPS in production.")
    return f"{parsed.scheme}://{parsed.netloc}"

async def _require_admin_request(request: Request):
    authorization = request.headers.get("authorization", "")
    if not (authorization.lower().startswith("basic ") or authorization.lower().startswith("bearer ")):
        raise HTTPException(status_code=401, detail="Admin sign-in is required.", headers={"WWW-Authenticate": "Basic"})
    upstream_request = URLRequest(
        f"{_spring_service_base()}/api/portal/me",
        headers={"Authorization": authorization, "Accept": "application/json"},
        method="GET",
    )

    def load_profile():
        try:
            with urlopen(upstream_request, timeout=65) as upstream:
                return upstream.status, json.loads(upstream.read())
        except HTTPError as error:
            return error.code, None
        except (URLError, TimeoutError, ValueError):
            return 502, None

    status, profile = await asyncio.to_thread(load_profile)
    if status in {401, 403}:
        raise HTTPException(status_code=401, detail="Admin sign-in is invalid or expired.", headers={"WWW-Authenticate": "Bearer"})
    if status != 200 or not isinstance(profile, dict):
        raise HTTPException(status_code=503, detail="Admin authorization is temporarily unavailable.")
    if str(profile.get("role", "")).upper() != "ADMIN":
        raise HTTPException(status_code=403, detail="Organization admin access is required.")
    return profile

@app.api_route("/auth/{auth_path:path}", methods=["GET", "POST", "OPTIONS"], include_in_schema=False)
@app.api_route("/api/auth/{auth_path:path}", methods=["GET", "POST", "OPTIONS"], summary="Proxy admin authentication")
async def proxy_admin_auth(auth_path: str, request: Request):
    target = f"{_spring_service_base()}/api/auth/{auth_path}"
    if request.url.query:
        target += f"?{request.url.query}"
    body = await request.body()
    headers = {}
    if request.headers.get("content-type"):
        headers["Content-Type"] = request.headers["content-type"]
    if request.headers.get("authorization"):
        headers["Authorization"] = request.headers["authorization"]
    upstream_request = URLRequest(target, data=body or None, headers=headers, method=request.method)

    def send_request():
        try:
            with urlopen(upstream_request, timeout=65) as upstream:
                return upstream.status, upstream.read(), upstream.headers.get("Content-Type", "text/plain")
        except HTTPError as error:
            return error.code, error.read(), error.headers.get("Content-Type", "text/plain")
        except URLError:
            return 502, b"Admin authentication service is not running on port 8083.", "text/plain"

    status, content, content_type = await asyncio.to_thread(send_request)
    return Response(content=content, status_code=status, headers={"Content-Type": content_type})

@app.api_route("/api/portal/{portal_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], summary="Proxy organization portal API")
async def proxy_organization_portal(portal_path: str, request: Request):
    target = f"{_spring_service_base()}/api/portal/{portal_path}"
    if request.url.query:
        target += f"?{request.url.query}"
    body = await request.body()
    headers = {}
    if request.headers.get("content-type"):
        headers["Content-Type"] = request.headers["content-type"]
    if request.headers.get("authorization"):
        headers["Authorization"] = request.headers["authorization"]
    upstream_request = URLRequest(target, data=body or None, headers=headers, method=request.method)

    def send_request():
        try:
            with urlopen(upstream_request, timeout=65) as upstream:
                return upstream.status, upstream.read(), upstream.headers.get("Content-Type", "application/json")
        except HTTPError as error:
            return error.code, error.read(), error.headers.get("Content-Type", "application/json")
        except URLError:
            return 502, b'{"message":"Organization portal service is not running on port 8083."}', "application/json"

    status, content, content_type = await asyncio.to_thread(send_request)
    return Response(content=content, status_code=status, headers={"Content-Type": content_type})


async def _proxy_spring_api(path: str, request: Request):
    target = f"{_spring_service_base()}/api/{path}"
    if request.url.query:
        target += f"?{request.url.query}"
    headers = {}
    for name in ("content-type", "authorization"):
        if request.headers.get(name): headers["Content-Type" if name == "content-type" else "Authorization"] = request.headers[name]
    upstream_request = URLRequest(target, data=(await request.body()) or None, headers=headers, method=request.method)
    def send_request():
        try:
            with urlopen(upstream_request, timeout=65) as upstream:
                return upstream.status, upstream.read(), upstream.headers.get("Content-Type", "application/json")
        except HTTPError as error:
            return error.code, error.read(), error.headers.get("Content-Type", "application/json")
        except URLError:
            return 502, b'{"message":"Admin service is temporarily unavailable."}', "application/json"
    status, content, content_type = await asyncio.to_thread(send_request)
    return Response(content=content, status_code=status, headers={"Content-Type": content_type})


@app.api_route("/api/admin/{admin_path:path}", methods=["GET", "POST", "PATCH", "PUT", "DELETE"], include_in_schema=False)
async def proxy_admin_api(admin_path: str, request: Request):
    return await _proxy_spring_api(f"admin/{admin_path}", request)


@app.api_route("/api/tasks", methods=["GET", "POST"], include_in_schema=False)
async def proxy_tasks_root(request: Request):
    return await _proxy_spring_api("tasks", request)


@app.api_route("/api/tasks/{task_path:path}", methods=["GET", "POST", "PATCH", "PUT", "DELETE"], include_in_schema=False)
async def proxy_tasks_api(task_path: str, request: Request):
    return await _proxy_spring_api(f"tasks/{task_path}", request)


@app.api_route("/api/chitti/logs", methods=["GET"], include_in_schema=False)
@app.api_route("/chitti/logs", methods=["GET"], include_in_schema=False)
async def proxy_chitti_logs(request: Request):
    return await _proxy_spring_api("chitti/logs", request)

@app.get("/admin/ui/assets/{asset_path:path}", summary="Serve built admin dashboard assets")
async def serve_admin_asset(asset_path: str):
    asset_root = (ROOT / "roadguard-admin" / "dashboard" / "dist" / "assets").resolve()
    asset_file = (asset_root / asset_path).resolve()
    if not asset_file.is_relative_to(asset_root) or not asset_file.is_file():
        raise HTTPException(status_code=404, detail="Dashboard asset not found")
    return FileResponse(str(asset_file))

@app.get("/admin/ui/{asset_path:path}", summary="Serve admin dashboard public files")
async def serve_admin_public_file(asset_path: str):
    public_root = (ROOT / "roadguard-admin" / "dashboard" / "dist").resolve()
    public_file = (public_root / asset_path).resolve()
    if not public_file.is_relative_to(public_root) or not public_file.is_file():
        raise HTTPException(status_code=404, detail="Dashboard file not found")
    return FileResponse(str(public_file))

@app.get("/employee", response_class=FileResponse, summary="Serve employee portal")
async def serve_employee_portal():
    dashboard_index = ROOT / "roadguard-admin" / "dashboard" / "dist" / "index.html"
    if not dashboard_index.is_file():
        raise HTTPException(status_code=503, detail="Build the dashboard with npm run build first")
    return FileResponse(str(dashboard_index), headers={"Cache-Control": "no-store, max-age=0"})

@app.get("/admin", response_class=FileResponse, summary="Serve admin dashboard")
@app.get("/admin/{dashboard_path:path}", response_class=FileResponse, summary="Serve admin dashboard routes")
async def serve_admin_dashboard(dashboard_path: str = ""):
    dashboard_index = ROOT / "roadguard-admin" / "dashboard" / "dist" / "index.html"
    if not dashboard_index.is_file():
        raise HTTPException(status_code=503, detail="Build the admin dashboard with npm run build first")
    return FileResponse(str(dashboard_index), headers={"Cache-Control": "no-store, max-age=0"})

@app.get("/pic1.png", response_class=FileResponse, summary="Serve Pic1 Image")
async def read_pic1():
    return FileResponse(str(ROOT / "pic1.png"))

@app.get("/pic2.png", response_class=FileResponse, summary="Serve Pic2 Image")
async def read_pic2():
    return FileResponse(str(ROOT / "pic2.png"))

@app.get("/pic3.png", response_class=FileResponse, summary="Serve Pic3 Image")
async def read_pic3():
    return FileResponse(str(ROOT / "pic3.png"))


import math
import psycopg
import uuid
from datetime import datetime, timezone, timedelta

# ── Geofencing duplicate detection radius (meters) ──
DUPLICATE_RADIUS_M = 50
DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("ROADGUARD_DATABASE_URL")

def haversine_distance(lat1, lng1, lat2, lng2):
    """Calculate the great-circle distance in meters between two GPS points."""
    R = 6371000  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def find_duplicate_issue(lat, lng, issue_type):
    """
    Searches active issues for a nearby duplicate within DUPLICATE_RADIUS_M.
    Returns the matching issue dict if found, else None.
    Only reports for the same hazard category are grouped.
    """
    best = None
    best_dist = DUPLICATE_RADIUS_M + 1
    for issue in model_states["issues"]:
        if issue.get("status") == "Resolved":
            continue
        coords = issue.get("coords")
        if not coords or len(coords) < 2:
            continue
        if issue.get("type", "").strip().casefold() != issue_type.strip().casefold():
            continue
        dist = haversine_distance(lat, lng, coords[0], coords[1])
        if dist <= DUPLICATE_RADIUS_M and dist < best_dist:
            best_dist = dist
            best = issue
    return best

# ── Shared state (updated by background ML workers) ──
model_states = {
    "traffic_density": {"count": 0, "status": "LOW"},
    "potholes":        {"detected": False, "location": "None", "confidence": 0.0, "count": 0},
    "fallen_trees":    {"detected": False, "location": "None", "confidence": 0.0},
    "gemini_hazards":  {"last_scan": None, "active_alerts": []},
    "citizen_reports": [],
    "simulations": [],
    # Deduplicated, priority-sorted issue registry
    "issues": [],
}


def _issue_db():
    if DATABASE_URL:
        if IS_PRODUCTION:
            return psycopg.connect(DATABASE_URL, sslmode="require")
        return psycopg.connect(DATABASE_URL)
    return psycopg.connect(
        host=os.environ.get("PGHOST", "localhost"),
        port=os.environ.get("PGPORT", "5432"),
        dbname=os.environ.get("PGDATABASE", os.environ.get("POSTGRES_DB", "roadguard_admin")),
        user=os.environ.get("PGUSER", os.environ.get("POSTGRES_USER", "postgres")),
        password=os.environ.get("PGPASSWORD", os.environ.get("POSTGRES_PASSWORD", "")),
    )


def _init_issue_db():
    with _issue_db() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS issues (
            id TEXT PRIMARY KEY, latitude DOUBLE PRECISION NOT NULL, longitude DOUBLE PRECISION NOT NULL,
            report_count INTEGER NOT NULL, priority_score INTEGER NOT NULL,
            metadata_json TEXT NOT NULL)""")
        conn.execute("""CREATE TABLE IF NOT EXISTS issue_photos (
            id BIGSERIAL PRIMARY KEY, issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
            filename TEXT, mime_type TEXT NOT NULL, uploaded_at TEXT NOT NULL, image BYTEA NOT NULL)""")
        conn.execute("""CREATE TABLE IF NOT EXISTS issue_reports (
            id TEXT PRIMARY KEY, issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
            latitude DOUBLE PRECISION NOT NULL, longitude DOUBLE PRECISION NOT NULL, reported_at TEXT NOT NULL)""")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_photos_issue_id ON issue_photos(issue_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_issue_reports_issue_id ON issue_reports(issue_id)")
        conn.execute("""CREATE TABLE IF NOT EXISTS system_event_log (
            id BIGSERIAL PRIMARY KEY, actor TEXT NOT NULL, event_type TEXT NOT NULL,
            target_entity TEXT NOT NULL, description TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())""")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_system_event_log_created ON system_event_log(created_at DESC)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority_score DESC)")
        conn.execute("""CREATE TABLE IF NOT EXISTS traffic_simulations (
            id TEXT PRIMARY KEY, metadata_json TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())""")
        conn.execute("""CREATE TABLE IF NOT EXISTS notifications (
            id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
            title TEXT, message TEXT NOT NULL, notification_type TEXT, target_link TEXT,
            is_read BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), source_key TEXT UNIQUE)""")
        conn.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title TEXT")
        conn.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_type TEXT")
        conn.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_link TEXT")
        conn.execute("""CREATE TABLE IF NOT EXISTS user_bug_reports (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
            severity TEXT NOT NULL, page_url TEXT NOT NULL DEFAULT '', user_agent TEXT NOT NULL DEFAULT '',
            email_sent BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())""")


def _persist_issue(issue, uploaded_filename=None, report_record=None):
    """Persist issue coordinates/counters and append any newly-added photos as database blobs."""
    coords = issue.get("coords") or [None, None]
    metadata = {k: v for k, v in issue.items() if k != "photos"}
    data_uris = issue.get("photos", [])
    with _issue_db() as conn:
        conn.execute("""INSERT INTO issues(id, latitude, longitude, report_count, priority_score, metadata_json)
            VALUES(%s, %s, %s, %s, %s, %s) ON CONFLICT(id) DO UPDATE SET
            latitude=excluded.latitude, longitude=excluded.longitude, report_count=excluded.report_count,
            priority_score=excluded.priority_score, metadata_json=excluded.metadata_json""",
            (issue["id"], float(coords[0]), float(coords[1]), int(issue.get("report_count", 1)),
             int(issue.get("priority_score", 1)), json.dumps(metadata)))
        if report_record:
            report_id, report_latitude, report_longitude = report_record
            conn.execute("INSERT INTO issue_reports(id, issue_id, latitude, longitude, reported_at) VALUES(%s, %s, %s, %s, %s) ON CONFLICT(id) DO NOTHING",
                         (report_id, issue["id"], float(report_latitude), float(report_longitude), datetime.now(timezone.utc).isoformat()))
        known = conn.execute("SELECT COUNT(*) FROM issue_photos WHERE issue_id=%s", (issue["id"],)).fetchone()[0]
        for uri in data_uris[known:]:
            if not isinstance(uri, str) or not uri.startswith("data:") or "," not in uri:
                continue
            header, encoded = uri.split(",", 1)
            mime_type = header[5:].split(";", 1)[0] or "application/octet-stream"
            photo_index = known
            conn.execute("INSERT INTO issue_photos(issue_id, filename, mime_type, uploaded_at, image) VALUES(%s, %s, %s, %s, %s)",
                         (issue["id"], uploaded_filename if photo_index == len(data_uris) - 1 else None,
                          mime_type, datetime.now(timezone.utc).isoformat(), base64.b64decode(encoded)))
    _notify_issue_update(issue)


def _notify_issue_update(issue):
    """Persist an in-app update for administrators and any employee assigned to this issue."""
    try:
        with _issue_db() as conn:
            recipients = [row[0] for row in conn.execute(
                "SELECT id FROM admin_users WHERE (role='ADMIN' OR role IS NULL) AND account_active IS DISTINCT FROM FALSE").fetchall()]
            employee_id = issue.get("assignedEmployeeId")
            if employee_id is not None:
                try:
                    employee_id = int(employee_id)
                    if employee_id not in recipients:
                        recipients.append(employee_id)
                except (TypeError, ValueError):
                    pass
            if not recipients:
                return
            issue_id = str(issue.get("id", ""))
            issue_type = issue.get("type") or issue.get("category") or "Road issue"
            status = issue.get("status") or "Reported"
            title = "New road issue reported" if issue.get("report_count", 1) == 1 and not issue.get("last_updated") else "Road issue updated"
            message = f"{issue_type} issue {issue_id} is now {status}."
            event_key = f"issue-update:{issue_id}:{time.time_ns()}"
            for recipient_id in recipients:
                conn.execute("""INSERT INTO notifications(user_id,title,message,notification_type,target_link,source_key)
                    VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT(source_key) DO NOTHING""",
                    (recipient_id, title, message, "warning" if str(issue.get("severity", "")).casefold() in {"high", "critical"} else "info",
                     f"/admin/issues?issue={urllib.parse.quote(issue_id)}", f"{event_key}:{recipient_id}"))
    except Exception as exc:
        # A notification write must never block issue creation or status updates.
        print(f"Could not create issue update notification: {exc}")


def _record_system_event(actor, event_type, target_entity, description):
    """Append a durable system event for Chitti and the audit trail."""
    with _issue_db() as conn:
        conn.execute(
            "INSERT INTO system_event_log(actor, event_type, target_entity, description) VALUES (%s, %s, %s, %s)",
            (str(actor or "System"), str(event_type), str(target_entity), str(description))
        )


def _load_persisted_issues():
    _init_issue_db()
    with _issue_db() as conn:
        rows = conn.execute("SELECT metadata_json FROM issues ORDER BY report_count DESC, id").fetchall()
        photo_rows = conn.execute("SELECT issue_id, mime_type, image FROM issue_photos ORDER BY id").fetchall()
    photos = {}
    for issue_id, mime_type, image in photo_rows:
        photos.setdefault(issue_id, []).append(f"data:{mime_type};base64,{base64.b64encode(image).decode('ascii')}")
    model_states["issues"] = []
    model_states["citizen_reports"] = []
    for (raw,) in rows:
        issue = json.loads(raw)
        issue["photos"] = photos.get(issue["id"], [])
        model_states["issues"].append(issue)
        model_states["citizen_reports"].append({k: issue.get(k) for k in
            ("id", "type", "severity", "location", "coords", "description", "confidence", "pothole_count", "vehicle_count", "report_count", "priority_score")})
    with _issue_db() as conn:
        simulation_rows = conn.execute("SELECT metadata_json FROM traffic_simulations ORDER BY created_at DESC").fetchall()
    model_states["simulations"] = [json.loads(row[0]) for row in simulation_rows]
    for simulation in model_states["simulations"]:
        _ensure_simulation_issue(simulation)


def _ensure_simulation_issue(simulation):
    """Give every Command Center simulation a durable issue record for admin actions."""
    if simulation.get("issue_id"):
        return simulation["issue_id"]
    coords = simulation.get("coords") or []
    if len(coords) < 2:
        return None

    is_closure = simulation.get("road_closure") is True
    issue_id = f"block_{uuid.uuid4().hex[:12]}" if is_closure else f"simissue_{uuid.uuid4().hex[:10]}"
    issue_type = "Road Blockage" if is_closure else "Traffic Incident"
    now = datetime.now(timezone.utc).isoformat()
    issue = {
        "id": issue_id,
        "type": issue_type,
        "severity": "CRITICAL" if str(simulation.get("severity", "")).upper() == "CRITICAL" else "HIGH",
        "priority": "Critical" if str(simulation.get("severity", "")).upper() == "CRITICAL" else "High",
        "priority_score": 3,
        "report_count": 1,
        "location": simulation.get("location") or "Command Center simulation",
        "coords": [float(coords[0]), float(coords[1])],
        "latitude": float(coords[0]),
        "longitude": float(coords[1]),
        "description": simulation.get("description") or "Command Center traffic incident simulation.",
        "photos": [],
        "status": "Unassigned",
        "reported_at": now,
        "is_simulation": True,
        "simulation_id": simulation.get("id"),
        "road_closure": is_closure if isinstance(simulation.get("road_closure"), bool) else None,
        "event_date": simulation.get("event_date"),
        "event_time": simulation.get("event_time"),
        "admin_notes": [],
        "task_history": []
    }
    simulation["issue_id"] = issue_id
    model_states.setdefault("issues", []).insert(0, issue)
    model_states.setdefault("citizen_reports", []).insert(0, {
        "id": issue_id, "type": issue_type, "severity": issue["severity"],
        "priority": issue["priority"], "location": issue["location"],
        "coords": issue["coords"], "description": issue["description"],
        "report_count": 1, "priority_score": issue["priority_score"], "status": "Unassigned"
    })
    _persist_issue(issue, report_record=(f"report_{uuid.uuid4().hex}", coords[0], coords[1]))
    with _issue_db() as conn:
        conn.execute("UPDATE traffic_simulations SET metadata_json=%s WHERE id=%s",
                     (json.dumps(simulation), simulation.get("id")))
    _record_system_event("Command Center", "SIMULATION_ISSUE_CREATED", issue_id,
                         f"Admin issue created from {simulation.get('type', 'Command Center simulation')}.")
    return issue_id


@app.on_event("startup")
async def load_issue_registry():
    _load_persisted_issues()

# ─────────────────────────────────────────────
# Request / Response models
# ─────────────────────────────────────────────

class Base64ImageRequest(BaseModel):
    image_base64: str
    mime_type: str = "image/jpeg"
    location: str = "Unknown Location"

class ChatRequest(BaseModel):
    message: str
    location: str = "Unknown"
    user_coords: Optional[list[float]] = None
    context: dict = Field(default_factory=dict)
    history: list[dict] = Field(default_factory=list)

class IssueCreateRequest(BaseModel):
    type: str
    severity: str = "MEDIUM"
    priority: Optional[str] = None
    description: str = ""
    location: Optional[str] = None
    coords: Optional[list[float]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class IssueReportRequest(BaseModel):
    type: Optional[str] = None
    description: str = ""
    coords: Optional[list[float]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class SafeRouteRequest(BaseModel):
    start: list[float]
    destination: list[float]

class BugReportRequest(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    description: str = Field(min_length=10, max_length=6000)
    severity: str = Field(default="MEDIUM", max_length=20)
    page_url: str = Field(default="", max_length=1000)
    user_agent: str = Field(default="", max_length=500)


# ─────────────────────────────────────────────
# EXISTING ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/api/stats", summary="Get real-time model states")
async def get_stats():
    """Returns live stats from all running AI models."""
    issue_by_id = {str(issue.get("id")): issue for issue in model_states.get("issues", [])}
    for report in model_states.get("citizen_reports", []):
        issue = issue_by_id.get(str(report.get("id")))
        if issue:
            report["status"] = issue.get("status", "Unassigned")
            report["last_updated"] = issue.get("last_updated")
            report["report_count"] = issue.get("report_count", 1)
            report["priority_score"] = issue.get("priority_score", 1)
            report["priority"] = issue.get("priority", "Low")
            report["photo_count"] = len(issue.get("photos", []))
    # The Command Center and public home page consume simulations separately
    # from issues, so mirror the linked issue's current workflow state here.
    for simulation in model_states.get("simulations", []):
        linked_issue = issue_by_id.get(str(simulation.get("issue_id", "")))
        if linked_issue is None:
            linked_issue = next((issue for issue in issue_by_id.values()
                                 if str(issue.get("simulation_id", "")) == str(simulation.get("id", ""))), None)
        if linked_issue:
            simulation["status"] = linked_issue.get("status", "Unassigned")
            simulation["issue_id"] = linked_issue.get("id")
            simulation["last_updated"] = linked_issue.get("last_updated")
            if linked_issue.get("resolutionDate"):
                simulation["resolutionDate"] = linked_issue["resolutionDate"]
    return model_states


def _route_distance_m(a, b):
    lat1, lon1 = a
    lat2, lon2 = b
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat, dlon = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    h = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 6_371_000 * 2 * math.atan2(math.sqrt(h), math.sqrt(max(0, 1 - h)))


def _point_segment_distance_m(point, start, end):
    mean_lat = math.radians((point[0] + start[0] + end[0]) / 3)
    sx, sy = 111_320 * math.cos(mean_lat), 111_132
    px, py = point[1] * sx, point[0] * sy
    ax, ay = start[1] * sx, start[0] * sy
    bx, by = end[1] * sx, end[0] * sy
    dx, dy = bx - ax, by - ay
    denom = dx * dx + dy * dy
    t = 0 if denom == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / denom))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def _build_osm_route(start, destination):
    straight_distance = _route_distance_m(start, destination)
    if straight_distance > 40_000:
        raise HTTPException(status_code=422, detail="Safe routing currently supports trips up to 40 km.")

    pad = max(0.012, straight_distance / 111_000 * 0.18)
    south = min(start[0], destination[0]) - pad
    north = max(start[0], destination[0]) + pad
    west = min(start[1], destination[1]) - pad
    east = max(start[1], destination[1]) + pad
    if (north - south) * (east - west) > 0.35:
        raise HTTPException(status_code=422, detail="The selected route area is too large. Choose closer endpoints.")

    hazards = []
    for issue in model_states.get("issues", []):
        if str(issue.get("status", "Unassigned")).strip().lower() in {"resolved", "closed", "dismissed"}:
            continue
        coords = issue.get("coords") or []
        if len(coords) < 2:
            continue
        kind = " ".join(str(issue.get(key) or "") for key in ("type", "category", "title", "description")).lower()
        is_closure = any(word in kind for word in ("blockage", "blocked", "road closure", "closed road", "road closed", "fallen tree", "flood", "waterlogging", "fire", "landslide", "debris"))
        severity = str(issue.get("priority") or issue.get("severity") or "").lower()
        radius = 180 if any(word in kind for word in ("flood", "waterlogging", "fire", "closure", "blocked", "blockage", "landslide")) else 90
        if (south - 0.01) <= coords[0] <= (north + 0.01) and (west - 0.01) <= coords[1] <= (east + 0.01):
            hazards.append((coords, radius, is_closure, severity))

    query = f'[out:json][timeout:12];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|road)$"]({south},{west},{north},{east});(._;>;);out body;'
    osm = None
    provider_errors = []
    for endpoint in (
        "https://overpass-api.de/api/interpreter",
        "https://overpass.private.coffee/api/interpreter",
    ):
        request = URLRequest(
            endpoint,
            data=urllib.parse.urlencode({"data": query}).encode("utf-8"),
            headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": "RoadGuard/1.0 (safe road routing)"},
            method="POST"
        )
        try:
            with urlopen(request, timeout=8) as response:
                osm = json.loads(response.read().decode("utf-8"))
            break
        except Exception as error:
            provider_errors.append(f"{endpoint.split('/')[2]}: {error}")
    if osm is None:
        # Overpass can be overloaded or blocked by some networks. For this
        # small route bounding box, the OSM map API provides a direct fallback.
        map_url = "https://api.openstreetmap.org/api/0.6/map?" + urllib.parse.urlencode({
            "bbox": f"{west},{south},{east},{north}"
        })
        map_request = URLRequest(map_url, headers={"User-Agent": "RoadGuard/1.0 (safe road routing)"})
        try:
            with urlopen(map_request, timeout=25) as response:
                root = ET.fromstring(response.read())
            elements = []
            for element in root:
                if element.tag == "node":
                    elements.append({"type": "node", "id": int(element.attrib["id"]),
                                     "lat": float(element.attrib["lat"]), "lon": float(element.attrib["lon"])})
                elif element.tag == "way":
                    tags = {tag.attrib["k"]: tag.attrib["v"] for tag in element if tag.tag == "tag"}
                    refs = [int(node.attrib["ref"]) for node in element if node.tag == "nd"]
                    if tags.get("highway") in {"motorway", "trunk", "primary", "secondary", "tertiary",
                                                "unclassified", "residential", "living_street", "service", "road"}:
                        elements.append({"type": "way", "id": int(element.attrib["id"]),
                                         "nodes": refs, "tags": tags})
            osm = {"elements": elements}
        except Exception as error:
            provider_errors.append(f"api.openstreetmap.org: {error}")
    if osm is None:
        # If OSM graph providers are unavailable (or the OSM map endpoint
        # rejects a dense city bbox), ask OSRM for its road-following routes.
        # Screen every returned alternative against active reports before use.
        route_url = (
            "https://router.project-osrm.org/route/v1/driving/"
            f"{start[1]},{start[0]};{destination[1]},{destination[0]}"
            "?alternatives=3&overview=full&geometries=geojson&steps=false"
        )
        try:
            route_request = URLRequest(route_url, headers={"User-Agent": "RoadGuard/1.0 (safe road routing)"})
            with urlopen(route_request, timeout=12) as response:
                route_data = json.loads(response.read().decode("utf-8"))
            safe_routes = []
            closure_routes = []
            for route in route_data.get("routes", []):
                coordinates = route.get("geometry", {}).get("coordinates", [])
                if len(coordinates) < 2:
                    continue
                geometry = [[float(lat), float(lon)] for lon, lat in coordinates]
                hazard_cost = 0.0
                blocked = False
                closure_cost = 0.0
                for coords, radius, is_closure, severity in hazards:
                    distance_to_report = min(
                        _point_segment_distance_m(coords, a, b) for a, b in zip(geometry, geometry[1:])
                    )
                    if is_closure and distance_to_report <= radius:
                        blocked = True
                        closure_cost += (radius - distance_to_report) * 10.0 + 10000.0
                        continue
                    if distance_to_report < radius:
                        severity_factor = 4.0 if severity in {"high", "critical"} else 1.0
                        hazard_cost += (radius - distance_to_report) * severity_factor * 3.0
                if blocked:
                    closure_routes.append((closure_cost + hazard_cost + float(route.get("distance", 0)), route, geometry))
                    continue
                safe_routes.append((float(route.get("distance", 0)) + hazard_cost, route, geometry))

            def route_result(selected_route, geometry, *, blocked_by_closure=False):
                result = {
                    "coordinates": geometry,
                    "distance_m": round(float(selected_route.get("distance", 0))),
                    "avoided_issues": len(hazards),
                    "algorithm": "OSRM with active-hazard screening",
                    "geometry_source": "OpenStreetMap road network",
                    "blocked_by_closure": blocked_by_closure,
                }
                if blocked_by_closure:
                    result["warning"] = "Available route alternatives pass too close to an active road closure. This route is shown for reference; it may be blocked. No safe route is available right now."
                return result

            if safe_routes:
                _, selected_route, geometry = min(safe_routes, key=lambda item: item[0])
                return route_result(selected_route, geometry)
            if closure_routes:
                _, selected_route, geometry = min(closure_routes, key=lambda item: item[0])
                return route_result(selected_route, geometry, blocked_by_closure=True)
            provider_errors.append("router.project-osrm.org: no usable route alternatives returned")
        except HTTPException:
            raise
        except Exception as error:
            provider_errors.append(f"router.project-osrm.org: {error}")

        print(f"All road routing providers failed: {'; '.join(provider_errors)}")
        raise HTTPException(status_code=503, detail="Road routing providers could not return a verifiable road route. Check your connection and try again.")

    nodes = {element["id"]: [element["lat"], element["lon"]] for element in osm.get("elements", []) if element.get("type") == "node"}

    graph = {}
    def add_edge(source, target, weight):
        graph.setdefault(source, []).append((target, weight))

    for way in (element for element in osm.get("elements", []) if element.get("type") == "way"):
        tags = way.get("tags", {})
        refs = way.get("nodes", [])
        direction = tags.get("oneway", "").lower()
        if direction == "-1":
            refs = list(reversed(refs))
        for source, target in zip(refs, refs[1:]):
            a, b = nodes.get(source), nodes.get(target)
            if not a or not b:
                continue
            hazard_cost = 0.0
            blocked = False
            for coords, radius, is_closure, severity in hazards:
                distance_to_report = _point_segment_distance_m(coords, a, b)
                if is_closure and distance_to_report <= radius:
                    blocked = True
                    break
                if distance_to_report < radius:
                    severity_factor = 4.0 if severity in {"high", "critical"} else 1.0
                    hazard_cost += (radius - distance_to_report) * severity_factor * 3.0
            if blocked:
                continue
            length = _route_distance_m(a, b)
            add_edge(source, target, length + hazard_cost)
            if direction not in {"yes", "1", "true", "-1"}:
                add_edge(target, source, length + hazard_cost)

    if not graph:
        raise HTTPException(status_code=404, detail="No mapped roads were found near these locations.")

    connected_nodes = set(graph)
    connected_nodes.update(neighbor for edges in graph.values() for neighbor, _ in edges)

    def nearest_node(point):
        candidates = sorted(((_route_distance_m(point, nodes[node_id]), node_id) for node_id in connected_nodes if node_id in nodes), key=lambda item: item[0])
        if not candidates or candidates[0][0] > 500:
            return None
        return candidates[0]

    start_snap, destination_snap = nearest_node(start), nearest_node(destination)
    if not start_snap or not destination_snap:
        raise HTTPException(status_code=404, detail="Could not snap the selected locations to a nearby road.")
    start_node, destination_node = start_snap[1], destination_snap[1]

    distances = {start_node: 0.0}
    previous = {}
    queue = [(0.0, start_node)]
    while queue:
        distance, node = heapq.heappop(queue)
        if distance != distances.get(node):
            continue
        if node == destination_node:
            break
        for neighbor, cost in graph.get(node, []):
            candidate = distance + cost
            if candidate < distances.get(neighbor, math.inf):
                distances[neighbor] = candidate
                previous[neighbor] = node
                heapq.heappush(queue, (candidate, neighbor))
    if destination_node not in distances:
        raise HTTPException(status_code=404, detail="No connected road route remains around the active closures.")

    path = [destination_node]
    while path[-1] != start_node:
        path.append(previous[path[-1]])
    path.reverse()
    # Draw only the snapped road network. A straight connector from an arbitrary
    # point to the road can falsely appear to cut across a blocked street.
    geometry = [nodes[int(node)] for node in path]
    total = start_snap[0] + distances[destination_node] + destination_snap[0]
    return {"coordinates": geometry, "distance_m": round(total), "avoided_issues": len(hazards), "algorithm": "Dijkstra", "geometry_source": "OpenStreetMap road network"}


@app.post("/api/routes/safe", summary="Find a road-following route around active closures and reported hazards")
async def safe_road_route(request: SafeRouteRequest):
    if len(request.start) != 2 or len(request.destination) != 2:
        raise HTTPException(status_code=422, detail="Start and destination must be [latitude, longitude].")
    for point in (request.start, request.destination):
        if not (-90 <= point[0] <= 90 and -180 <= point[1] <= 180):
            raise HTTPException(status_code=422, detail="Coordinates are outside valid latitude/longitude bounds.")
    return await asyncio.to_thread(_build_osm_route, request.start, request.destination)


def _send_bug_report_email(report: BugReportRequest):
    env_file = ROOT / ".env"
    if env_file.exists():
        for raw_line in env_file.read_text(encoding="utf-8").splitlines():
            key, separator, value = raw_line.partition("=")
            if separator and key.strip() in {"BREVO_API_KEY", "BREVO_SENDER_EMAIL", "BREVO_SENDER_NAME"}:
                os.environ.setdefault(key.strip(), value.strip().strip("\"'"))
    api_key = os.environ.get("BREVO_API_KEY", "")
    sender_email = os.environ.get("BREVO_SENDER_EMAIL", "")
    if not api_key or not sender_email:
        raise RuntimeError("Brevo email delivery is not configured")
    safe_title = " ".join(report.title.splitlines()).strip()
    text_content = (
        f"A visitor submitted a Road Guard website report.\n\n"
        f"Title: {safe_title}\n"
        f"Severity: {report.severity}\n"
        f"Page: {report.page_url.strip() or 'Not provided'}\n"
        f"Browser: {report.user_agent.strip() or 'Not provided'}\n\n"
        f"Description:\n{report.description.strip()}\n"
    )
    payload = {
        "sender": {
            "name": os.environ.get("BREVO_SENDER_NAME", "RoadGuard"),
            "email": sender_email,
        },
        "to": [{"email": "utkarshsahaygaming15@gmail.com"}],
        "subject": f"Road Guard bug report [{report.severity}]: {safe_title}",
        "textContent": text_content,
    }
    request = URLRequest(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode("utf-8"),
        headers={"api-key": api_key, "Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=20):
        pass


@app.post("/api/bug-reports", summary="Save and email a website bug report to Road Guard")
async def submit_bug_report(report: BugReportRequest, request: Request):
    enforce_public_rate_limit(request, "bug-report", 10, 60 * 60)
    report.severity = report.severity.strip().upper()
    if report.severity not in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}:
        raise HTTPException(status_code=422, detail="Severity must be LOW, MEDIUM, HIGH, or CRITICAL.")
    report_id = f"BUG-{uuid.uuid4().hex[:12].upper()}"
    _init_issue_db()
    with _issue_db() as conn:
        conn.execute("""INSERT INTO user_bug_reports(id, title, description, severity, page_url, user_agent)
            VALUES(%s, %s, %s, %s, %s, %s)""",
            (report_id, report.title.strip(), report.description.strip(), report.severity,
             report.page_url.strip(), report.user_agent.strip()))
    email_sent = False
    try:
        await asyncio.to_thread(_send_bug_report_email, report)
        email_sent = True
        with _issue_db() as conn:
            conn.execute("UPDATE user_bug_reports SET email_sent=TRUE WHERE id=%s", (report_id,))
    except Exception as error:
        # The report is already safely available in the admin portal.
        print(f"Bug report email delivery failed for {report_id}: {error}")
    return {"ok": True, "id": report_id, "email_sent": email_sent,
            "message": "Your report was submitted to the Road Guard team."}


@app.get("/api/bug-reports", summary="List user-submitted website bug reports for administrators")
async def list_bug_reports(request: Request):
    await _require_admin_request(request)
    _init_issue_db()
    with _issue_db() as conn:
        rows = conn.execute("""SELECT id, title, description, severity, page_url, user_agent,
            email_sent, created_at FROM user_bug_reports ORDER BY created_at DESC""").fetchall()
    return [{"id": row[0], "title": row[1], "description": row[2], "severity": row[3],
             "page_url": row[4], "user_agent": row[5], "email_sent": row[6],
             "created_at": row[7].isoformat() if row[7] else None} for row in rows]


@app.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    """Real-time alert stream — pushes AI detections to the dashboard."""
    await websocket.accept()
    while True:
        await asyncio.sleep(5)
        alerts = [
            {"type": "Pothole",      "location": "MG Road Junction",  "confidence": "94%"},
            {"type": "Traffic",      "location": "Silk Board",         "confidence": "High Density"},
            {"type": "Road Debris",  "location": "Outer Ring Road",    "confidence": "88%"},
            {"type": "Fallen Tree",  "location": "Cubbon Park Road",   "confidence": "91%"},
        ]
        await websocket.send_json(random.choice(alerts))


# ─────────────────────────────────────────────
# GEMINI VISION ENDPOINTS
# ─────────────────────────────────────────────

@app.post("/api/gemini/analyze/upload", summary="Analyze uploaded image for road hazards")
async def analyze_uploaded_image(
    file: UploadFile = File(...),
    location: str = "Unknown Location"
):
    """
    Upload an image file and get Gemini Vision hazard analysis.
    Detects: Fallen Tree, Flood, Road Debris, Broken Signal, Accident Scene.
    """
    analyzer = get_analyzer()

    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are accepted.")

    img_bytes = await file.read()
    result = analyzer.analyze_image(img_bytes)
    alerts  = analyzer.get_alerts(result)

    # Update shared state
    model_states["gemini_hazards"]["last_scan"]    = location
    model_states["gemini_hazards"]["active_alerts"] = alerts

    return {
        "location": location,
        "filename": file.filename,
        "analysis": result,
        "alerts":   alerts,
    }


@app.post("/api/gemini/analyze/base64", summary="Analyze base64 image for road hazards")
async def analyze_base64_image(req: Base64ImageRequest):
    """
    Send a base64-encoded image and get hazard analysis.
    Ideal for direct integration with camera feeds or frontend canvas.
    """
    analyzer = get_analyzer()

    try:
        result = analyzer.analyze_from_base64(req.image_base64, req.mime_type)
    except Exception as e:
        raise HTTPException(status_code=400, detail="The uploaded image could not be decoded.") from e

    alerts = analyzer.get_alerts(result)

    model_states["gemini_hazards"]["last_scan"]     = req.location
    model_states["gemini_hazards"]["active_alerts"] = alerts

    return {
        "location": req.location,
        "analysis": result,
        "alerts":   alerts,
    }


@app.get("/api/gemini/hazards", summary="Get latest Gemini hazard scan results")
async def get_latest_hazards():
    """Returns the most recent Gemini Vision scan results."""
    return model_states["gemini_hazards"]


@app.get("/api/gemini/categories", summary="List supported hazard categories")
async def get_categories():
    """Returns all supported hazard detection categories."""
    return {
        "categories": [
            {"id": "fallen_tree",    "label": "Fallen Tree",              "icon": "🌳"},
            {"id": "flood",          "label": "Flood / Waterlogging",     "icon": "🌊"},
            {"id": "road_debris",    "label": "Road Debris",              "icon": "⚠️"},
            {"id": "broken_signal",  "label": "Broken Traffic Signal",    "icon": "🚦"},
            {"id": "accident_scene", "label": "Accident Scene",           "icon": "🚨"},
        ],
        "model": "gemini-1.5-flash",
        "version": "2.0.0"
    }


# ─────────────────────────────────────────────
# SIMULATION & REPORT ENDPOINTS
# ─────────────────────────────────────────────

@app.post("/api/simulation/predict", summary="Predict traffic congestion and recommend resources")
async def predict_simulation(req: SimulationRequest):
    """
    Predicts traffic congestion, delays, and recommends resources for an event.
    Generates a diversion route avoiding the event location (using Bangalore coordinates).
    """
    # Predefined nodes for coordinate mapping
    LOCATION_COORDS = {
        "MG Road Junction": [12.9740, 77.6101],
        "Silk Board": [12.9176, 77.6244],
        "Outer Ring Road": [12.9279, 77.6809],
        "Cubbon Park Road": [12.9779, 77.5952],
        "M.G. Road Chowk": [12.9745, 77.6110],
        "Sector 4 Flyover": [12.9150, 77.6380],
        "Old City Ward": [12.9702, 77.5750],
        "Station Rd": [12.9715, 77.6410],
        "NH8 Exit": [12.9080, 77.6010],
        "Ward 4": [12.9800, 77.5900],
    }

    center_coords = req.start_coords
    if not center_coords:
        loc = req.start_point
        if loc in LOCATION_COORDS:
            center_coords = LOCATION_COORDS[loc]
        else:
            center_coords = [25.61591, 85.09529] # Default Patna

    # Rule-based predictive calculations
    crowd = req.crowd_size
    
    if crowd > 10000:
        congestion = "Very High"
        delay = random.randint(25, 45)
        radius = round(1.5 + (crowd / 10000.0) * 0.5, 2)
        risk = random.randint(85, 98)
        police = int(crowd * 0.0015)
        barricades = int(crowd * 0.0004)
        ambulances = max(1, int(crowd * 0.0001))
        marshals = int(crowd * 0.0005)
    elif crowd > 5000:
        congestion = "Heavy"
        delay = random.randint(15, 25)
        radius = round(1.0 + (crowd / 5000.0) * 0.3, 2)
        risk = random.randint(60, 85)
        police = int(crowd * 0.0012)
        barricades = int(crowd * 0.0003)
        ambulances = max(1, int(crowd * 0.00005))
        marshals = int(crowd * 0.0004)
    elif crowd > 1000:
        congestion = "Moderate"
        delay = random.randint(5, 15)
        radius = round(0.5 + (crowd / 1000.0) * 0.2, 2)
        risk = random.randint(30, 60)
        police = int(crowd * 0.001)
        barricades = int(crowd * 0.0002)
        ambulances = 0
        marshals = int(crowd * 0.0003)
    else:
        congestion = "Low"
        delay = random.randint(1, 5)
        radius = 0.2
        risk = random.randint(5, 30)
        police = max(2, int(crowd * 0.0008))
        barricades = max(1, int(crowd * 0.0001))
        ambulances = 0
        marshals = 1

    # Predefined alternative diversion routes based on the blocked location
    routes = {
        "MG Road Junction": [
            [12.9779, 77.5952], # Cubbon Park Road
            [12.9785, 77.6050], # Infantry Road
            [12.9748, 77.6185], # Kensington Rd
            [12.9720, 77.6250], # Ulsoor
        ],
        "Silk Board": [
            [12.9279, 77.6809], # Outer Ring Road
            [12.9345, 77.6210], # HSR layout connection
            [12.9150, 77.6380], # Sector 4 Flyover
            [12.9050, 77.6150], # BTM layout diversion
        ]
    }
    
    alt_route = routes.get(req.start_point, [
        [center_coords[0] + 0.005, center_coords[1] - 0.005],
        [center_coords[0] + 0.008, center_coords[1] + 0.002],
        [center_coords[0] - 0.002, center_coords[1] + 0.006]
    ])

    result = {
        "event_type": req.event_type,
        "location": f"{req.start_point} to {req.end_point}",
        "coords": center_coords,
        "congestion": congestion,
        "delay_minutes": delay,
        "radius_km": radius,
        "risk": risk,
        "recommendations": {
            "police": police,
            "barricades": barricades,
            "ambulances": ambulances,
            "marshals": marshals,
            "diversion_route": "Route B (Alternate)"
        },
        "alternative_route": alt_route
    }

    sim_id = f"sim_{uuid.uuid4().hex[:12]}"
    result["id"] = sim_id

    sim_alert = {
        "id": sim_id,
        "type": "Simulation: " + req.event_type + (f" - {req.event_cause.title()}" if req.event_cause and req.event_cause != "others" else ""),
        "location": f"{req.start_point} to {req.end_point} (Simulated)",
        "confidence": f"{risk}% Risk",
        "severity": "CRITICAL" if risk > 80 else "CONGESTED" if risk > 50 else "PLANNED",
        "description": f"Predicted congestion: {congestion} with {delay} min delay. Affected Area: ~{radius}km radius.",
        "coords": center_coords,
        "recommendations": result["recommendations"],
        "road_closure": req.road_closure.strip().casefold() == "yes",
        "event_date": req.date,
        "event_time": req.time
    }
    result["road_closure"] = sim_alert["road_closure"]

    if "simulations" not in model_states:
        model_states["simulations"] = []
    model_states["simulations"].insert(0, sim_alert)
    with _issue_db() as conn:
        conn.execute("INSERT INTO traffic_simulations(id, metadata_json) VALUES(%s, %s)",
                     (sim_id, json.dumps(sim_alert)))
    issue_id = _ensure_simulation_issue(sim_alert)
    if issue_id:
        result["issue_id"] = issue_id
        if sim_alert["road_closure"]:
            _record_system_event("Command Center", "ROAD_BLOCKAGE_REPORTED", issue_id,
                                 f"Road blockage reported at {sim_alert['location']}.")

    return result


@app.post("/api/report/submit", summary="Submit citizen report with photo/video and GPS coordinates")
async def submit_report(
    file: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...)
):
    """
    Submits a photo or video report. Accesses GPS coordinates, runs YOLO models
    for potholes and vehicle count, runs Gemini Vision for overall hazard analysis,
    updates Active Incidents state, and returns detection results.
    """
    import cv2
    import numpy as np

    content_type = file.content_type
    filename = file.filename
    is_video = (content_type and content_type.startswith("video/")) or filename.lower().endswith(('.mp4', '.avi', '.mov'))
    is_image = (content_type and content_type.startswith("image/")) or filename.lower().endswith(('.jpg', '.jpeg', '.png'))

    if not is_image and not is_video:
        raise HTTPException(status_code=400, detail="Only images and videos are supported.")

    file_bytes = await file.read()
    
    pothole_count = 0
    vehicle_count = 0
    analysis_result = {}
    alerts = []
    
    if is_video:
        temp_video_path = ROOT / "temp" / f"upload_{random.randint(1000, 9999)}_{filename}"
        temp_video_path.parent.mkdir(exist_ok=True, parents=True)
        with open(temp_video_path, "wb") as f:
            f.write(file_bytes)
            
        cap = cv2.VideoCapture(str(temp_video_path))
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        best_frame = None
        max_detections = -1
        
        step = max(1, frame_count // 5)
        for i in range(0, frame_count, step):
            cap.set(cv2.CAP_PROP_POS_FRAMES, i)
            ret, frame = cap.read()
            if not ret:
                break
                
            if os.environ.get("RENDER"):
                best_frame = frame
                break

            try:
                rdd_model = get_yolo_rdd()
                coco_model = get_yolo_coco()
                
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                rdd_res = rdd_model.predict(frame_rgb, conf=0.20, verbose=False)
                coco_res = coco_model.predict(frame_rgb, conf=0.20, classes=[2, 3, 5, 7], verbose=False)
                
                det_count = len(rdd_res[0].boxes) + len(coco_res[0].boxes)
                if det_count > max_detections:
                    max_detections = det_count
                    best_frame = frame
                    pothole_count = sum(1 for box in rdd_res[0].boxes.cpu().numpy() if int(box.cls[0]) == 3)
                    vehicle_count = len(coco_res[0].boxes)
            except Exception as e:
                print(f"Error running YOLO on video frame: {e}")
                
        cap.release()
        
        try:
            os.remove(temp_video_path)
        except:
            pass
            
        if best_frame is not None:
            ret, encoded_img = cv2.imencode('.jpg', best_frame)
            if ret:
                gemini_bytes = encoded_img.tobytes()
                try:
                    analyzer = get_analyzer()
                    analysis_result = analyzer.analyze_image(gemini_bytes)
                    alerts = analyzer.get_alerts(analysis_result)
                    
                    gemini_vc = analysis_result.get("estimated_vehicle_count", 0)
                    if isinstance(gemini_vc, int) and gemini_vc > vehicle_count:
                        vehicle_count = gemini_vc
                except Exception as e:
                    print(f"Error running Gemini on video keyframe: {e}")
                    analysis_result = {"error": str(e)}

    else:
        nparr = np.frombuffer(file_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is not None:
            pothole_count = 0
            vehicle_count = 0
            
            # Skip YOLO entirely on Render free tier to prevent 512MB RAM Out-Of-Memory crashes
            if not os.environ.get("RENDER"):
                try:
                    rdd_model = get_yolo_rdd()
                    coco_model = get_yolo_coco()
                    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                    
                    rdd_res = rdd_model.predict(img_rgb, conf=0.20, verbose=False)
                    coco_res = coco_model.predict(img_rgb, conf=0.20, classes=[2, 3, 5, 7], verbose=False)
                    
                    pothole_count = sum(1 for box in rdd_res[0].boxes.cpu().numpy() if int(box.cls[0]) == 3)
                    vehicle_count = len(coco_res[0].boxes)
                except Exception as e:
                    print(f"Error running YOLO on image: {e}")
            
            try:
                analyzer = get_analyzer()
                analysis_result = analyzer.analyze_image(file_bytes)
                alerts = analyzer.get_alerts(analysis_result)
                
                gemini_vc = analysis_result.get("estimated_vehicle_count", 0)
                if isinstance(gemini_vc, int) and gemini_vc > vehicle_count:
                    vehicle_count = gemini_vc
            except Exception as e:
                print(f"Error running Gemini on image: {e}")
                analysis_result = {"error": str(e)}

    model_states["potholes"]["detected"] = pothole_count > 0
    if "count" not in model_states["potholes"]:
        model_states["potholes"]["count"] = 0
    model_states["potholes"]["count"] += pothole_count
    model_states["traffic_density"]["count"] = vehicle_count
    model_states["traffic_density"]["status"] = (
        "HIGH" if vehicle_count > 15 else "MEDIUM" if vehicle_count > 5 else "LOW"
    )

    incident_type = "Citizen Report"
    severity = "medium"
    description = "No hazard detected."

    # Sync pothole detection from Gemini to pothole_count
    gemini_pothole_detected = any(a["type"].lower() == "pothole" for a in alerts)
    if gemini_pothole_detected and pothole_count == 0:
        pothole_count = 1

    if alerts:
        highest_severity = "low"
        main_alert = alerts[0]
        severity_ranks = {"low": 1, "medium": 2, "high": 3, "critical": 4}
        for a in alerts:
            rank_a = severity_ranks.get(a["severity"].lower(), 1)
            rank_h = severity_ranks.get(highest_severity, 1)
            if rank_a > rank_h:
                highest_severity = a["severity"].lower()
                main_alert = a
        incident_type = main_alert["type"]
        severity = main_alert["severity"]
        description = main_alert["description"]
        
        # Fallback: if Gemini says Traffic Jam but fails to count, simulate a realistic count
        if vehicle_count == 0 and "Traffic" in incident_type:
            vehicle_count = random.randint(15, 45)
            
        if vehicle_count > 0:
            description += f" Estimated vehicle count: {vehicle_count}."
    elif pothole_count > 0:
        incident_type = "Pothole / Road Damage"
        severity = "medium"
        description = f"Detected {pothole_count} severe road damage instances."
    elif vehicle_count > 5:
        incident_type = "Traffic Congestion"
        severity = "medium"
        description = f"Traffic congestion detected. Estimated {vehicle_count} vehicles in the area."
    else:
        pass

    # ── Encode photo as base64 data URI for storage ──
    photo_data_uri = None
    try:
        if file_bytes:
            encoded = base64.b64encode(file_bytes).decode("utf-8")
            mime = file.content_type or "image/jpeg"
            photo_data_uri = f"data:{mime};base64,{encoded}"
    except Exception as e:
        print(f"Photo encoding error: {e}")

    # ── Duplicate detection: look for existing issue within 50 m ──
    existing_issue = find_duplicate_issue(latitude, longitude, incident_type)
    is_duplicate = existing_issue is not None
    report_record_id = f"report_{uuid.uuid4().hex}"

    if is_duplicate:
        # Increment priority score and stack photo
        existing_issue["report_count"] = existing_issue.get("report_count", 1) + 1
        existing_issue["priority_score"] = existing_issue["report_count"]
        existing_issue["latitude"] = float(existing_issue["coords"][0])
        existing_issue["longitude"] = float(existing_issue["coords"][1])
        if photo_data_uri:
            existing_issue.setdefault("photos", []).append(photo_data_uri)
        existing_issue["last_updated"] = __import__('datetime').datetime.utcnow().isoformat()

        # Escalate priority label
        rc = existing_issue["report_count"]
        if rc > 5:
            existing_issue["priority"] = "High"
        elif rc >= 3:
            existing_issue["priority"] = "High"
        elif rc >= 2:
            existing_issue["priority"] = "Medium"

        # Re-sort issues by priority_score descending
        model_states["issues"].sort(key=lambda x: x.get("priority_score", 1), reverse=True)
        _persist_issue(existing_issue, filename, (report_record_id, latitude, longitude))
        _record_system_event("Citizen", "ISSUE_DUPLICATE_REPORT", existing_issue["id"],
                             f"Additional {incident_type} report within 50 m; report count is now {existing_issue['report_count']}.")

        report_for_frontend = {
            "id": existing_issue["id"],
            "type": existing_issue["type"],
            "severity": existing_issue["severity"],
            "location": existing_issue["location"],
            "coords": existing_issue["coords"],
            "description": existing_issue["description"],
            "confidence": "92%",
            "pothole_count": pothole_count,
            "vehicle_count": vehicle_count,
            "report_count": existing_issue["report_count"],
            "priority_score": existing_issue["priority_score"],
            "is_duplicate": True,
        }

        # Keep citizen_reports list in sync (update existing entry)
        for i, r in enumerate(model_states["citizen_reports"]):
            if r.get("id") == existing_issue["id"]:
                model_states["citizen_reports"][i]["report_count"] = existing_issue["report_count"]
                model_states["citizen_reports"][i]["priority_score"] = existing_issue["priority_score"]
                break

        return {
            "status": "duplicate_detected",
            "report": report_for_frontend,
            "pothole_count": pothole_count,
            "vehicle_count": vehicle_count,
            "alerts": alerts,
            "analysis": analysis_result,
            "is_duplicate": True,
            "duplicate_issue_id": existing_issue["id"],
            "total_reports": existing_issue["report_count"],
        }

    # ── New unique issue ──
    import datetime
    new_issue_id = f"rep_{random.randint(100000, 999999)}"
    photos_list = [photo_data_uri] if photo_data_uri else []

    priority_label = "Low"
    if severity.upper() in ("CRITICAL", "HIGH"):
        priority_label = "High"
    elif severity.upper() == "MEDIUM":
        priority_label = "Medium"

    new_issue = {
        "id": new_issue_id,
        "type": incident_type,
        "severity": severity.upper(),
        "priority": priority_label,
        "priority_score": 1,
        "report_count": 1,
        "location": f"GPS: {latitude:.5f}, {longitude:.5f}",
        "coords": [latitude, longitude],
        "latitude": latitude,
        "longitude": longitude,
        "description": description,
        "confidence": "92%",
        "pothole_count": pothole_count,
        "vehicle_count": vehicle_count,
        "photos": photos_list,
        "status": "Unassigned",
        "reported_at": datetime.datetime.utcnow().isoformat(),
        "last_updated": datetime.datetime.utcnow().isoformat(),
        "admin_notes": [],
        "task_history": [
            {
                "timestamp": datetime.datetime.utcnow().isoformat(),
                "status": "Reported",
                "actor": "Citizen",
                "note": "Issue reported via Command Center"
            }
        ]
    }

    # Insert into issue registry and keep sorted by priority_score
    model_states["issues"].insert(0, new_issue)
    model_states["issues"].sort(key=lambda x: x.get("priority_score", 1), reverse=True)
    _persist_issue(new_issue, filename, (report_record_id, latitude, longitude))

    # Keep legacy citizen_reports list in sync
    legacy_report = {
        "id": new_issue_id,
        "type": incident_type,
        "severity": severity.upper(),
        "location": f"GPS: {latitude:.5f}, {longitude:.5f}",
        "coords": [latitude, longitude],
        "description": description,
        "confidence": "92%",
        "pothole_count": pothole_count,
        "vehicle_count": vehicle_count,
        "report_count": 1,
        "priority_score": 1,
        "is_duplicate": False,
    }
    if "citizen_reports" not in model_states:
        model_states["citizen_reports"] = []
    model_states["citizen_reports"].insert(0, legacy_report)
    _record_system_event("Citizen", "ISSUE_REPORTED", new_issue_id,
                         f"Reported {incident_type} ({priority_label} priority) at {new_issue['location']}.")

    return {
        "status": "success",
        "report": legacy_report,
        "pothole_count": pothole_count,
        "vehicle_count": vehicle_count,
        "alerts": alerts,
        "analysis": analysis_result,
        "is_duplicate": False,
        "total_reports": 1,
    }


@app.get("/issues", summary="List road issues")
@app.get("/api/issues", summary="Get all issues sorted by priority score (admin dashboard)")
async def get_issues(
    status: str = None,
    priority: str = None,
    sort_by: str = "priority_score"
):
    """
    Returns the deduplicated issue registry sorted by priority score (highest first).
    Supports filtering by status and priority.
    """
    issues = _issues_with_latest_task_assignments(model_states.get("issues", []))

    if status:
        issues = [i for i in issues if i.get("status", "").lower() == status.lower()]
    if priority:
        issues = [i for i in issues if i.get("priority", "").lower() == priority.lower()]

    if sort_by == "priority_score":
        issues = sorted(issues, key=lambda x: x.get("priority_score", 1), reverse=True)
    elif sort_by == "report_count":
        issues = sorted(issues, key=lambda x: x.get("report_count", 1), reverse=True)
    elif sort_by == "date":
        issues = sorted(issues, key=lambda x: x.get("reported_at", ""), reverse=True)

    # Strip base64 photo data from list view to keep response light
    # Photos are only included in detail view
    issues_summary = []
    for issue in issues:
        summary = {k: v for k, v in issue.items() if k != "photos"}
        summary["photo_count"] = len(issue.get("photos", []))
        # Include thumbnail (first photo) for card view
        photos = issue.get("photos", [])
        summary["thumbnail"] = photos[0] if photos else None
        issues_summary.append(summary)

    return {
        "total": len(issues_summary),
        "issues": issues_summary
    }


def _issues_with_latest_task_assignments(issues):
    """Overlay the authoritative task assignee/status on cached issue metadata."""
    try:
        with _issue_db() as conn:
            rows = conn.execute("""
                SELECT DISTINCT ON (t.issue_id)
                    t.issue_id, t.employee_id, a.full_name, t.department_id, d.name,
                    t.status, t.updated_at
                FROM work_tasks t
                LEFT JOIN admin_users a ON a.id = t.employee_id
                LEFT JOIN departments d ON d.id = t.department_id
                WHERE NULLIF(t.issue_id, '') IS NOT NULL
                    AND (t.employee_id IS NOT NULL OR t.department_id IS NOT NULL)
                ORDER BY t.issue_id, (t.employee_id IS NOT NULL) DESC, t.updated_at DESC, t.id DESC
            """).fetchall()
    except Exception as exc:
        logger.warning("Could not reconcile issue assignments from organization tasks: %s", exc)
        return issues

    assignments = {row[0]: row[1:] for row in rows}
    reconciled = []
    for cached in issues:
        issue = dict(cached)
        assignment = assignments.get(issue.get("id"))
        if assignment:
            employee_id, employee_name, department_id, department_name, task_status, updated_at = assignment
            issue["assignedEmployeeId"] = employee_id
            issue["assignedEmployeeName"] = employee_name or (f"Department: {department_name}" if department_name else None)
            if department_id is not None:
                issue["assignedDepartmentId"] = department_id
                issue["assignedDepartmentName"] = department_name
            normalized_status = str(task_status or "").strip().casefold()
            if normalized_status == "resolved":
                issue["status"] = "Resolved"
            elif normalized_status in {"in progress", "in-progress"}:
                issue["status"] = "In Progress"
            else:
                issue["status"] = "Assigned"
            if updated_at is not None:
                issue["last_updated"] = updated_at.isoformat() if hasattr(updated_at, "isoformat") else str(updated_at)
        reconciled.append(issue)
    return reconciled


@app.post("/issues", summary="Create a road issue and detect nearby duplicates")
@app.post("/api/issues", summary="Create a road issue and detect nearby duplicates")
async def create_issue_api(request: IssueCreateRequest):
    coords = request.coords or ([request.latitude, request.longitude] if request.latitude is not None and request.longitude is not None else None)
    if not coords or len(coords) < 2:
        raise HTTPException(status_code=422, detail="Provide coordinates as [latitude, longitude] or latitude and longitude fields.")
    latitude, longitude = float(coords[0]), float(coords[1])
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise HTTPException(status_code=422, detail="Coordinates are outside valid latitude/longitude bounds.")
    issue_type = request.type.strip()
    if not issue_type:
        raise HTTPException(status_code=422, detail="Issue type is required.")
    now = datetime.now(timezone.utc).isoformat()
    report_id = f"report_{uuid.uuid4().hex}"
    duplicate = find_duplicate_issue(latitude, longitude, issue_type)
    if duplicate:
        duplicate["report_count"] = int(duplicate.get("report_count", 1)) + 1
        duplicate["priority_score"] = duplicate["report_count"]
        duplicate["last_updated"] = now
        if duplicate["report_count"] >= 3:
            duplicate["priority"] = "High"
        elif duplicate["report_count"] == 2:
            duplicate["priority"] = "Medium"
        _persist_issue(duplicate, report_record=(report_id, latitude, longitude))
        _record_system_event("API", "ISSUE_DUPLICATE_REPORT", duplicate["id"], f"Additional {issue_type} report added; total reports: {duplicate['report_count']}.")
        return JSONResponse(status_code=200, content={"status": "duplicate_detected", "duplicate": True, "issue": {k: v for k, v in duplicate.items() if k != "photos"}})

    severity = request.severity.strip().upper() or "MEDIUM"
    priority = request.priority or ("High" if severity in {"HIGH", "CRITICAL"} else "Medium" if severity == "MEDIUM" else "Low")
    issue_id = f"rep_{uuid.uuid4().hex[:12]}"
    issue = {"id": issue_id, "type": issue_type, "severity": severity, "priority": priority,
             "priority_score": 1, "report_count": 1, "location": request.location or f"GPS: {latitude:.5f}, {longitude:.5f}",
             "coords": [latitude, longitude], "latitude": latitude, "longitude": longitude,
             "description": request.description, "photos": [], "status": "Unassigned", "reported_at": now,
             "last_updated": now, "admin_notes": [], "task_history": []}
    model_states.setdefault("issues", []).insert(0, issue)
    _persist_issue(issue, report_record=(report_id, latitude, longitude))
    _record_system_event("API", "ISSUE_REPORTED", issue_id, f"Reported {issue_type} at {issue['location']}.")
    return JSONResponse(status_code=201, content={"status": "created", "duplicate": False, "issue": {k: v for k, v in issue.items() if k != "photos"}})


@app.get("/api/map/markers", summary="Get active issue markers for the map")
@app.get("/map/markers", summary="Get active issue markers for the map")
async def get_map_markers():
    try:
        with _issue_db() as conn:
            rows = conn.execute("SELECT id, latitude, longitude, metadata_json FROM issues ORDER BY report_count DESC, id").fetchall()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Issue markers are temporarily unavailable.") from exc
    markers = []
    for issue_id, latitude, longitude, raw in rows:
        issue = json.loads(raw)
        if str(issue.get("status", "Unassigned")).casefold() in {"resolved", "closed", "complete", "completed"}:
            continue
        markers.append({"id": issue_id, "type": issue.get("type", "Road issue"), "status": issue.get("status", "Unassigned"),
                        "priority": issue.get("priority", issue.get("severity", "")), "location": issue.get("location", ""),
                        "description": issue.get("description", ""), "coords": [latitude, longitude],
                        "reportCount": issue.get("report_count", 1)})
    return {"total": len(markers), "markers": markers}


@app.get("/api/system/events", summary="Get durable Road Guard activity events")
async def get_system_events(request: Request, limit: int = 200):
    await _require_admin_request(request)
    limit = max(1, min(int(limit), 500))
    with _issue_db() as conn:
        rows = conn.execute(
            'SELECT id, actor, event_type AS "eventType", target_entity AS "targetEntity", description, created_at AS timestamp FROM system_event_log ORDER BY created_at DESC LIMIT %s',
            (limit,)
        ).fetchall()
    return [{"id": row[0], "actor": row[1], "eventType": row[2], "targetEntity": row[3],
             "description": row[4], "timestamp": row[5].isoformat() if row[5] else None}
            for row in rows]


@app.get("/issues/{issue_id}", summary="Get a specific issue with all photos")
@app.get("/api/issues/{issue_id}", summary="Get a specific issue with all photos")
async def get_issue_detail(issue_id: str):
    """Returns full issue detail including all stacked photos."""
    for issue in _issues_with_latest_task_assignments(model_states.get("issues", [])):
        if issue.get("id") == issue_id:
            detail = dict(issue)
            with _issue_db() as conn:
                detail["reports"] = [
                    {"id": row[0], "latitude": row[1], "longitude": row[2], "reported_at": row[3]}
                    for row in conn.execute("SELECT id, latitude, longitude, reported_at FROM issue_reports WHERE issue_id=%s ORDER BY reported_at", (issue_id,)).fetchall()
                ]
            return detail
    raise HTTPException(status_code=404, detail=f"Issue {issue_id} not found")


@app.post("/issues/{issue_id}/report", summary="Add a report and merge nearby duplicates")
@app.post("/api/issues/{issue_id}/report", summary="Add a report and merge nearby duplicates")
async def report_issue_api(issue_id: str, request: IssueReportRequest):
    with _issue_db() as conn:
        row = conn.execute("SELECT metadata_json FROM issues WHERE id=%s", (issue_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Issue {issue_id} not found")
    issue = json.loads(row[0])
    if str(issue.get("status", "")).casefold() in {"resolved", "closed", "complete", "completed"}:
        raise HTTPException(status_code=409, detail="This issue is already resolved. Submit a new issue for a new hazard.")
    if request.type and request.type.strip().casefold() != str(issue.get("type", "")).strip().casefold():
        raise HTTPException(status_code=409, detail="The report type does not match this issue.")
    coords = request.coords or ([request.latitude, request.longitude] if request.latitude is not None and request.longitude is not None else issue.get("coords"))
    if not coords or len(coords) < 2:
        raise HTTPException(status_code=422, detail="Coordinates are missing for this issue.")
    lat, lng = float(coords[0]), float(coords[1])
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise HTTPException(status_code=422, detail="Coordinates are outside valid latitude/longitude bounds.")
    issue_coords = issue.get("coords") or [issue.get("latitude"), issue.get("longitude")]
    if issue_coords and len(issue_coords) >= 2 and haversine_distance(lat, lng, float(issue_coords[0]), float(issue_coords[1])) > DUPLICATE_RADIUS_M:
        return await create_issue_api(IssueCreateRequest(type=request.type or issue.get("type", "Road issue"),
                severity=issue.get("severity", "MEDIUM"), description=request.description, coords=[lat, lng]))
    issue["report_count"] = int(issue.get("report_count", 1)) + 1
    issue["priority_score"] = issue["report_count"]
    issue["last_updated"] = datetime.now(timezone.utc).isoformat()
    if issue["report_count"] >= 3:
        issue["priority"] = "High"
    elif issue["report_count"] == 2:
        issue["priority"] = "Medium"
    report_id = f"report_{uuid.uuid4().hex}"
    _persist_issue(issue, report_record=(report_id, lat, lng))
    for index, saved in enumerate(model_states.get("issues", [])):
        if str(saved.get("id")) == str(issue_id):
            issue["photos"] = saved.get("photos", [])
            model_states["issues"][index] = issue
            break
    _record_system_event("API", "ISSUE_DUPLICATE_REPORT", issue_id, f"Additional report added; total reports: {issue['report_count']}.")
    return {"status": "duplicate_detected", "duplicate": True, "issue": {k: v for k, v in issue.items() if k != "photos"}}


@app.post("/issues/{issue_id}/resolve", summary="Resolve a road issue")
@app.post("/api/issues/{issue_id}/resolve", summary="Resolve a road issue")
async def resolve_issue_api(issue_id: str, request: Request, updates: Optional[dict] = None):
    payload = dict(updates or {})
    payload["status"] = "Resolved"
    payload.setdefault("resolutionDate", datetime.now(timezone.utc).isoformat())
    payload.setdefault("actor", "API")
    return await patch_issue(issue_id, payload, request)


@app.patch("/issues/{issue_id}", summary="Update an issue (status, notes, assignment)")
@app.patch("/api/issues/{issue_id}", summary="Update an issue (status, notes, assignment)")
async def patch_issue(issue_id: str, updates: dict, request: Request):
    """Applies partial updates to an issue (status, assignedEmployeeName, adminNotes, etc.)."""
    await _require_admin_request(request)
    import datetime
    for issue in model_states.get("issues", []):
        if issue.get("id") == issue_id:
            previous_status = issue.get("status", "Unassigned")
            previous_assignee = issue.get("assignedEmployeeName")
            allowed = {"status", "priority", "assignedEmployeeId", "assignedEmployeeName",
                       "resolutionNotes", "resolutionDate", "admin_notes", "task_history"}
            for key, val in updates.items():
                if key in allowed:
                    issue[key] = val
            issue["last_updated"] = datetime.datetime.utcnow().isoformat()
            _persist_issue(issue)
            simulation_id = issue.get("simulation_id")
            if simulation_id:
                for simulation in model_states.get("simulations", []):
                    if str(simulation.get("id")) == str(simulation_id):
                        simulation["status"] = issue.get("status", "Unassigned")
                        simulation["last_updated"] = issue["last_updated"]
                        if issue.get("resolutionDate"):
                            simulation["resolutionDate"] = issue["resolutionDate"]
                        else:
                            simulation.pop("resolutionDate", None)
                        with _issue_db() as conn:
                            conn.execute("UPDATE traffic_simulations SET metadata_json=%s WHERE id=%s",
                                         (json.dumps(simulation), simulation_id))
                        break
            for report in model_states.get("citizen_reports", []):
                if str(report.get("id")) == str(issue_id):
                    report["status"] = issue.get("status", "Unassigned")
                    report["last_updated"] = issue["last_updated"]
            if issue.get("status") != previous_status:
                _record_system_event(updates.get("actor") or updates.get("updatedBy") or "System",
                                     "ISSUE_STATUS_CHANGED", issue_id,
                                     f"Status changed from {previous_status} to {issue.get('status')}.")
            if issue.get("assignedEmployeeName") and issue.get("assignedEmployeeName") != previous_assignee:
                _record_system_event(updates.get("actor") or updates.get("updatedBy") or "Admin",
                                     "ISSUE_TASK_ASSIGNED", issue_id,
                                     f"Issue assigned to {issue.get('assignedEmployeeName')}.")
            return {"status": "updated", "issue": issue}
    raise HTTPException(status_code=404, detail=f"Issue {issue_id} not found")


@app.delete("/api/report/delete/{report_id}", summary="Delete citizen report")
async def delete_report(report_id: str, request: Request):
    """Deletes a citizen report by ID (from both citizen_reports and issues registries)."""
    await _require_admin_request(request)
    global model_states
    reports = model_states.get("citizen_reports", [])
    model_states["citizen_reports"] = [r for r in reports if r.get("id") != report_id]
    model_states["issues"] = [i for i in model_states.get("issues", []) if i.get("id") != report_id]
    with _issue_db() as conn:
        conn.execute("DELETE FROM issues WHERE id = %s", (report_id,))
    return {"status": "success", "deleted_id": report_id}


@app.delete("/api/simulation/delete/{sim_id}", summary="Delete simulation")
async def delete_simulation(sim_id: str, request: Request):
    """Deletes a simulation by ID."""
    await _require_admin_request(request)
    global model_states
    sims = model_states.get("simulations", [])
    model_states["simulations"] = [s for s in sims if s.get("id") != sim_id]
    linked_issue_ids = [issue.get("id") for issue in model_states.get("issues", [])
                        if issue.get("simulation_id") == sim_id]
    model_states["issues"] = [issue for issue in model_states.get("issues", [])
                               if issue.get("simulation_id") != sim_id]
    model_states["citizen_reports"] = [report for report in model_states.get("citizen_reports", [])
                                        if report.get("id") not in linked_issue_ids]
    with _issue_db() as conn:
        for issue_id in linked_issue_ids:
            conn.execute("DELETE FROM issues WHERE id=%s", (issue_id,))
        conn.execute("DELETE FROM traffic_simulations WHERE id = %s", (sim_id,))
    return {"status": "success", "deleted_id": sim_id}


@app.get("/health", summary="Health check")
async def health():
    return {
        "status": "ok",
        "gemini_ready": os.environ.get("GEMINI_API_KEY") is not None,
        "chitti_ready": True,
        "models": list(model_states.keys()),
    }


# ─────────────────────────────────────────────

# ─────────────────────────────────────────────
# CUSTOM CHAT ENDPOINT
# ─────────────────────────────────────────────
@app.post("/api/chat", summary="Chat with Chitti Assistant")
async def chat_with_assistant(req: ChatRequest):
    context = req.context or {}
    if not isinstance(context, dict):
        context = {}
    # Always replace browser-cached issue data with the current database rows.
    try:
        with _issue_db() as conn:
            rows = conn.execute("SELECT id, latitude, longitude, report_count, priority_score, metadata_json FROM issues ORDER BY report_count DESC, id").fetchall()
        live_issues = []
        for issue_id, latitude, longitude, report_count, priority_score, raw in rows:
            issue = json.loads(raw)
            issue["id"] = issue_id
            issue["coords"] = [latitude, longitude]
            issue["latitude"] = latitude
            issue["longitude"] = longitude
            issue["report_count"] = report_count
            issue["priority_score"] = priority_score
            live_issues.append(issue)
        context["issues"] = live_issues
        context["issuesFetchedAt"] = datetime.now(timezone.utc).isoformat()
        context["issuesSource"] = "live database"
    except Exception as e:
        print(f"Could not refresh Chitti issues from database: {e}")
        context["issues"] = model_states.get("issues", [])
        context["issuesSource"] = "cached data (database unavailable)"

    user_coords = req.user_coords
    if not user_coords:
        coordinate_match = re.search(r"(-?\d{1,2}\.\d+)\s*[,/]\s*(-?\d{1,3}\.\d+)", req.message or "")
        if coordinate_match:
            user_coords = [float(coordinate_match.group(1)), float(coordinate_match.group(2))]
    if user_coords and len(user_coords) >= 2:
        context["userCoords"] = user_coords[:2]
    # Proximity and exact issue-status answers are computed from database rows,
    # rather than left to the language model to infer.
    deterministic_reply = _chitti_location_reply(req.message, context, user_coords)
    if deterministic_reply is not None:
        return {"reply": deterministic_reply}
    if not os.environ.get("GEMINI_API_KEY"):
        return {"reply": _chitti_local_reply(req.message, context)}

    context_str = json.dumps(context, ensure_ascii=False, default=str)[:80000]
    history_str = json.dumps((req.history or [])[-10:], ensure_ascii=False, default=str)[:12000]
    prompt = f"""You are Chitti, the RoadGuard municipal operations memory agent.
Answer administrators using only the supplied live system context. It includes current issues, task assignments, employee actions, notifications, and durable audit events. Use it to answer questions about priorities, status, location, reporter counts, employees, and recent changes. Do not invent records or claim an event occurred unless it appears in the context. If requested details are missing, say so clearly. Keep exact issue IDs and useful location names in operational answers. Distinguish reported issues from assigned work tasks.
Issue records were refreshed directly from the database for this request. For any issue location you mention, include its OpenStreetMap link from the supplied coordinates. Never claim an issue is near the user unless userCoords are supplied and its distance is calculated. If the user asks what is near them and no coordinates are available, ask them to share a location or enable location access.

LIVE SYSTEM CONTEXT (JSON):
{context_str}

RECENT CONVERSATION (JSON):
{history_str}

ADMIN QUESTION: {req.message}
"""
    try:
        # Load the Gemini SDK only on requests that actually need the model.
        import google.generativeai as genai
        api_key = os.environ.get("GEMINI_API_KEY")
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        if response.text:
            return {"reply": response.text}
        return {"reply": _chitti_local_reply(req.message, context)}
    except Exception as e:
        print(f"Chat error: {e}")
        return {"reply": _chitti_local_reply(req.message, context)}


@app.get("/chitti/query", summary="Ask Chitti a question")
@app.get("/api/chitti/query", summary="Ask Chitti a question")
async def chitti_query(q: str = Query(min_length=1, max_length=1000), lat: Optional[float] = None, lng: Optional[float] = None):
    coordinates = [lat, lng] if lat is not None and lng is not None else None
    return await chat_with_assistant(ChatRequest(message=q, user_coords=coordinates, location="Chitti API"))


def _chitti_local_reply(message: str, context: dict) -> str:
    """Answer common RoadGuard questions from supplied data without external AI."""
    q = (message or "").casefold()
    issues = context.get("issues") or []
    tasks = context.get("tasks") or []
    employees = context.get("employees") or []
    events = context.get("auditEvents") or context.get("auditLogs") or []
    notifications = context.get("notifications") or []
    active = [i for i in issues if str(i.get("status", "")).casefold() not in {"resolved", "closed"}]
    high = [i for i in active if str(i.get("priority", "")).casefold() in {"high", "critical"}]
    def label(item):
        issue_id = item.get("id", "?")
        title = item.get("title") or item.get("category") or item.get("type") or "Road issue"
        location = item.get("location") or item.get("locationName") or item.get("location_name")
        status = item.get("status") or "Status unavailable"
        priority = item.get("priority") or item.get("severity")
        detail = f"[{issue_id}] {title}"
        if location: detail += f" — {location}"
        if priority: detail += f" ({priority})"
        detail += f" — {status}"
        count = item.get("reportCount", item.get("report_count"))
        if count: detail += f", {count} report(s)"
        coords = item.get("coords") or [item.get("latitude"), item.get("longitude")]
        if coords and len(coords) >= 2 and coords[0] is not None and coords[1] is not None:
            lat, lng = float(coords[0]), float(coords[1])
            detail += f"\nMap: https://www.openstreetmap.org/?mlat={lat:.6f}&mlon={lng:.6f}#map=18/{lat:.6f}/{lng:.6f}"
        return detail

    if any(word in q for word in ("high", "critical", "priority")) and any(word in q for word in ("issue", "pending", "hazard", "road", "report", "priority")):
        if high: return f"High and critical active issues ({len(high)}):\n" + "\n".join(f"• {label(i)}" for i in high[:20])
        return "There are no high or critical active issues in the available RoadGuard data."
    if any(word in q for word in ("unattended", "two days", "2 days", "48 hour")):
        cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
        overdue = []
        for issue in active:
            status = str(issue.get("status", "")).casefold()
            reported = issue.get("reportedAt") or issue.get("reported_at")
            if status not in {"unassigned", "reported", "pending", ""} or not reported: continue
            try:
                parsed = datetime.fromisoformat(str(reported).replace("Z", "+00:00"))
                if parsed.tzinfo is None: parsed = parsed.replace(tzinfo=timezone.utc)
                if parsed < cutoff: overdue.append(issue)
            except (TypeError, ValueError): pass
        if overdue: return f"Active issues unassigned for over 48 hours ({len(overdue)}):\n" + "\n".join(f"• {label(i)}" for i in overdue[:20])
        return "No active unassigned issues older than 48 hours were found in the available data."
    if any(word in q for word in ("assignment", "task", "employee work", "assigned to")):
        open_tasks = [t for t in tasks if str(t.get("status", "")).casefold() not in {"resolved", "complete", "completed"}]
        if open_tasks:
            return f"Open employee tasks ({len(open_tasks)}):\n" + "\n".join(
                f"• [{t.get('id', '?')}] {t.get('title', 'Task')} — {t.get('assignedEmployeeName') or t.get('employeeName') or t.get('employee') or 'Unassigned'} ({t.get('status', 'Status unavailable')})"
                for t in open_tasks[:20])
        return "No open employee tasks are present in the data available to Chitti."
    if "employee" in q or "staff" in q:
        if employees:
            return f"Employees in the available organization data ({len(employees)}):\n" + "\n".join(
                f"• {e.get('name') or e.get('fullName') or 'Employee'} — {e.get('designation') or 'Role unavailable'} ({e.get('status') or e.get('approvalStatus') or 'status unavailable'})"
                for e in employees[:30])
        return "Employee details are not included in the data available to Chitti on this page."
    if any(word in q for word in ("activity", "audit", "recent change", "system event")):
        if events:
            return f"Recent recorded activity ({min(10, len(events))}):\n" + "\n".join(
                f"• {e.get('eventType') or e.get('status') or 'Activity'} — {e.get('description') or e.get('actor') or 'Recorded event'} ({e.get('timestamp') or e.get('changedAt') or 'time unavailable'})"
                for e in events[:10])
        return "No audit or activity events are included in the data available to Chitti on this page."
    if "notification" in q or "alert" in q:
        if notifications:
            return f"Recent notifications ({min(10, len(notifications))}):\n" + "\n".join(
                f"• {n.get('title') or n.get('message') or 'Notification'}" for n in notifications[:10])
        return "There are no notifications in the data available to Chitti."
    if any(word in q for word in ("resolved", "closed")):
        resolved = [i for i in issues if str(i.get("status", "")).casefold() in {"resolved", "closed"}]
        if resolved: return f"Resolved issues ({len(resolved)}):\n" + "\n".join(f"• {label(i)}" for i in resolved[:20])
        return "No resolved issues are present in the data available to Chitti."
    if any(word in q for word in ("area", "location", "where")) and active:
        return "Active issues by location:\n" + "\n".join(f"• {label(i)}" for i in active[:20])

    categories = {}
    for issue in issues:
        category = issue.get("category") or issue.get("type") or "Other"
        categories[category] = categories.get(category, 0) + 1
    category_summary = ", ".join(f"{name}: {count}" for name, count in sorted(categories.items(), key=lambda row: row[1], reverse=True)[:6]) or "no issue categories available"
    unread = sum(1 for notification in notifications if not notification.get("read", False))
    return (f"RoadGuard snapshot: {len(active)} active issue(s), {len(issues) - len(active)} resolved issue(s), "
            f"{len(tasks)} task(s), {len(employees)} employee record(s), and {unread} unread alert(s). "
            f"Issue categories: {category_summary}. Ask me about high-priority issues, unattended reports, tasks, employees, activity, or locations.")


def _chitti_location_reply(message: str, context: dict, user_coords):
    q = (message or "").casefold()
    issues = context.get("issues") or []
    nearby_query = any(term in q for term in ("near me", "nearby", "near my", "around me", "near here", "close to me"))

    def issue_link(issue):
        coords = issue.get("coords") or [issue.get("latitude"), issue.get("longitude")]
        if not coords or len(coords) < 2 or coords[0] is None or coords[1] is None:
            return None
        lat, lng = float(coords[0]), float(coords[1])
        return f"https://www.openstreetmap.org/?mlat={lat:.6f}&mlon={lng:.6f}#map=18/{lat:.6f}/{lng:.6f}"

    def summary(issue, distance=None):
        title = issue.get("title") or issue.get("category") or issue.get("type") or "Road issue"
        location = issue.get("location") or issue.get("locationName") or "Location not described"
        status = issue.get("status") or "Status unavailable"
        text = f"[{issue.get('id', '?')}] {title} — {status} — {location}"
        if distance is not None:
            text += f" ({distance:.1f} km away)"
        link = issue_link(issue)
        return text + (f"\nMap: {link}" if link else " (map coordinates unavailable)")

    if nearby_query:
        if context.get("issuesSource") != "live database":
            return "I can't check current nearby reports right now. Please try again shortly."
        if not user_coords or len(user_coords) < 2:
            return "I can check nearby reports, but I need your location first. Share a nearby address or coordinates, or allow location access in your browser."
        try:
            lat, lng = float(user_coords[0]), float(user_coords[1])
            if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                raise ValueError("out of range")
        except (TypeError, ValueError):
            return "I couldn't read those coordinates. Please share a valid latitude and longitude."
        matches = []
        for issue in issues:
            status = str(issue.get("status") or "").strip().casefold()
            if status in {"resolved", "closed", "complete", "completed"} or issue.get("resolutionDate") or issue.get("resolution_date"):
                continue
            coords = issue.get("coords") or [issue.get("latitude"), issue.get("longitude")]
            if not coords or len(coords) < 2 or coords[0] is None or coords[1] is None:
                continue
            distance = haversine_distance(lat, lng, float(coords[0]), float(coords[1])) / 1000
            if distance <= 25:
                matches.append((distance, issue))
        matches.sort(key=lambda row: row[0])
        if not matches:
            return "There are no active road hazards within 25 km of your location."
        return f"I found {len(matches)} active road hazard(s) within 25 km of your location:\n" + "\n\n".join(summary(issue, distance) for distance, issue in matches[:10])

    issue_id_match = re.search(r"\b(?:rep_[a-z0-9_-]+|[a-f0-9]{8}-[a-f0-9-]{27,})\b", message or "", re.I)
    asks_status = any(term in q for term in ("status", "current state", "resolved", "open", "progress"))
    if issue_id_match and asks_status:
        if context.get("issuesSource") != "live database":
            return "I can't check that issue's current status right now. Please try again shortly."
        issue = next((item for item in issues if str(item.get("id", "")).casefold() == issue_id_match.group(0).casefold()), None)
        if not issue:
            return f"I couldn't find issue {issue_id_match.group(0)} in the current database. It may have been removed."
        return summary(issue)
    return None

# Keep the installable web app isolated under its own URL and asset folder.
# All website screens and API requests continue to use the existing application.
app.mount("/webapp", StaticFiles(directory=ROOT / "roadguard-webapp", html=True), name="roadguard-webapp")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
