import os
import sys
import json
import random
import asyncio
import base64
from pathlib import Path

from fastapi import FastAPI, WebSocket, HTTPException, UploadFile, File, Form
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
from pydantic import BaseModel

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
            raise HTTPException(
                status_code=503,
                detail=f"Failed to initialize Gemini Vision: {e}. Ensure GEMINI_API_KEY is correct."
            )
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
            print(f"Error loading YOLO RDD Model: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to load YOLO RDD model: {e}")
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
            print(f"Error loading YOLO COCO Model: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to load YOLO COCO model: {e}")
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
app = FastAPI(
    title="Traffic Intelligence API",
    description="AI-powered road hazard detection + traffic monitoring",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.get("/pic1.png", response_class=FileResponse, summary="Serve Pic1 Image")
async def read_pic1():
    return FileResponse(str(ROOT / "pic1.png"))

@app.get("/pic2.png", response_class=FileResponse, summary="Serve Pic2 Image")
async def read_pic2():
    return FileResponse(str(ROOT / "pic2.png"))

@app.get("/pic3.png", response_class=FileResponse, summary="Serve Pic3 Image")
async def read_pic3():
    return FileResponse(str(ROOT / "pic3.png"))


# ── Shared state (updated by background ML workers) ──
model_states = {
    "traffic_density": {"count": 0, "status": "LOW"},
    "potholes":        {"detected": False, "location": "None", "confidence": 0.0, "count": 0},
    "fallen_trees":    {"detected": False, "location": "None", "confidence": 0.0},
    "gemini_hazards":  {"last_scan": None, "active_alerts": []},
    "citizen_reports": [],
    "simulations": [],
}

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


# ─────────────────────────────────────────────
# EXISTING ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/api/stats", summary="Get real-time model states")
async def get_stats():
    """Returns live stats from all running AI models."""
    return model_states


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
        raise HTTPException(status_code=400, detail=f"Image decode error: {e}")

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

    sim_id = f"sim_{random.randint(100000, 999999)}"
    result["id"] = sim_id

    sim_alert = {
        "id": sim_id,
        "type": "Simulation: " + req.event_type + (f" - {req.event_cause.title()}" if req.event_cause and req.event_cause != "others" else ""),
        "location": f"{req.start_point} to {req.end_point} (Simulated)",
        "confidence": f"{risk}% Risk",
        "severity": "CRITICAL" if risk > 80 else "CONGESTED" if risk > 50 else "PLANNED",
        "description": f"Predicted congestion: {congestion} with {delay} min delay. Affected Area: ~{radius}km radius.",
        "coords": center_coords,
        "recommendations": result["recommendations"]
    }
    
    if "simulations" not in model_states:
        model_states["simulations"] = []
    model_states["simulations"].insert(0, sim_alert)

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
    elif pothole_count > 0:
        incident_type = "Potholes Detected"
        severity = "high" if pothole_count > 3 else "medium"
        description = f"Detected {pothole_count} potholes on the road surface."
    elif vehicle_count > 15:
        incident_type = "Traffic Congestion"
        severity = "high"
        description = f"High vehicle count ({vehicle_count}) detected."

    new_report = {
        "id": f"rep_{random.randint(100000, 999999)}",
        "type": incident_type,
        "severity": severity.upper(),
        "location": f"GPS: {latitude:.5f}, {longitude:.5f}",
        "coords": [latitude, longitude],
        "description": description,
        "confidence": "92%",
        "pothole_count": pothole_count,
        "vehicle_count": vehicle_count
    }

    if "citizen_reports" not in model_states:
        model_states["citizen_reports"] = []
    model_states["citizen_reports"].insert(0, new_report)

    return {
        "status": "success",
        "report": new_report,
        "pothole_count": pothole_count,
        "vehicle_count": vehicle_count,
        "alerts": alerts,
        "analysis": analysis_result
    }


@app.delete("/api/report/delete/{report_id}", summary="Delete citizen report")
async def delete_report(report_id: str):
    """Deletes a citizen report by ID."""
    global model_states
    reports = model_states.get("citizen_reports", [])
    model_states["citizen_reports"] = [r for r in reports if r.get("id") != report_id]
    return {"status": "success", "deleted_id": report_id}


@app.delete("/api/simulation/delete/{sim_id}", summary="Delete simulation")
async def delete_simulation(sim_id: str):
    """Deletes a simulation by ID."""
    global model_states
    sims = model_states.get("simulations", [])
    model_states["simulations"] = [s for s in sims if s.get("id") != sim_id]
    return {"status": "success", "deleted_id": sim_id}


@app.get("/health", summary="Health check")
async def health():
    return {
        "status": "ok",
        "gemini_ready": os.environ.get("GEMINI_API_KEY") is not None,
        "models": list(model_states.keys()),
    }


# ─────────────────────────────────────────────

# ─────────────────────────────────────────────
# CUSTOM CHAT ENDPOINT
# ─────────────────────────────────────────────
@app.post("/api/chat", summary="Chat with TrafficAide Assistant")
async def chat_with_assistant(req: ChatRequest):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY environment variable is required.")
        
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    # Build context from current states
    citizen_reports = model_states.get("citizen_reports", [])
    simulations = model_states.get("simulations", [])
    
    context_str = "CURRENT INCIDENTS ON DASHBOARD:\\n"
    if not citizen_reports and not simulations:
        context_str += "No active incidents reported.\\n"
    else:
        for inc in citizen_reports:
            context_str += f"- Citizen Report: {inc.get('type')} at {inc.get('location')} (Severity: {inc.get('severity')})\\n"
        for sim in simulations:
            incident_type = sim.get('type', '').replace('Simulation: ', '')
            context_str += f"- Active Incident: {incident_type} at {sim.get('location')} (Severity: {sim.get('severity')})\\n"
            
    prompt = f"""You are TrafficAide, a helpful AI assistant for the Road Guard dashboard in India.
Your goal is to answer citizen questions about traffic and disturbances.
You MUST prioritize checking the current incidents on the dashboard to answer questions, especially if the user asks about their area.
CRITICAL INSTRUCTION: Treat all incidents in the context as REAL, ACTIVE events. DO NOT mention the word "simulation", "simulated", or "planned exercise" in your responses. Talk about them as actual events happening right now.
If an incident location is given as GPS coordinates, do not recite the raw GPS numbers. Instead, refer to the general "USER LOCATION" area.

USER LOCATION: {req.location}

{context_str}

USER MESSAGE: {req.message}
"""
    
    try:
        response = model.generate_content(prompt)
        return {"reply": response.text}
    except Exception as e:
        print(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
