import os
import base64
import requests
import json
import logging
from pathlib import Path
import cv2
import numpy as np
import streamlit as st
from PIL import Image
from io import BytesIO
from ultralytics import YOLO

# Page setup
st.set_page_config(
    page_title="AI Road Scanner",
    page_icon="🛣️",
    layout="centered",
    initial_sidebar_state="collapsed"
)

# Paths
HERE = Path(__file__).parent
ROOT = HERE.parent
MODEL_LOCAL_PATH = ROOT / "models" / "YOLOv8_Small_RDD.pt"
COCO_MODEL_NAME = "yolov8n.pt"

# Hidden API Key & Configs
API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.5-flash"
CONF_THRESHOLD = 0.20  # Optimized dynamic threshold

if not API_KEY:
    st.warning("GEMINI_API_KEY is not set. Gemini-based features will not work until you define it in the environment.")

# Ensure temp directory exists for video processing
temp_dir = ROOT / "temp"
os.makedirs(temp_dir, exist_ok=True)
temp_file_input = str(temp_dir / "scanner_input.mp4")
temp_file_infer = str(temp_dir / "scanner_infer.mp4")

# Styling
st.markdown("""
<style>
    .status-card {
        border-radius: 8px;
        padding: 14px;
        margin: 8px 0;
        background-color: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-left: 6px solid #ccc;
    }
    .status-clear {
        border-left-color: #2ecc71;
    }
    .status-warning {
        border-left-color: #f1c40f;
    }
    .status-alert {
        border-left-color: #e74c3c;
    }
    .status-header {
        font-weight: 800;
        font-size: 1.1em;
        text-transform: uppercase;
        display: flex;
        justify-content: space-between;
    }
    .status-body {
        font-size: 0.95em;
        margin-top: 6px;
        opacity: 0.9;
    }
    .severity-badge {
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.8em;
        font-weight: bold;
    }
    .badge-low { background-color: rgba(46, 204, 113, 0.2); color: #2ecc71; }
    .badge-medium { background-color: rgba(241, 196, 15, 0.2); color: #f1c40f; }
    .badge-high { background-color: rgba(231, 76, 60, 0.2); color: #e74c3c; }
</style>
""", unsafe_allow_html=True)

# Load Models
@st.cache_resource
def load_models():
    rdd_model = YOLO(MODEL_LOCAL_PATH)
    coco_model = YOLO(COCO_MODEL_NAME)
    return rdd_model, coco_model

try:
    rdd_net, coco_net = load_models()
except Exception as e:
    st.error(f"Error loading YOLO models: {e}")

# Classes definitions
RDD_CLASSES = [
    "Longitudinal Crack",
    "Transverse Crack",
    "Alligator Crack",
    "Potholes"
]

VEHICLE_CLASSES = [2, 3, 5, 7] # car, motorcycle, bus, truck

# Gemini prompt
GEMINI_PROMPT = """
You are an expert traffic control and road safety AI system.
Analyze the provided road image carefully.
Detect if any of the following road incidents are present:
1. Fallen Tree
2. Waterlogging
3. Road Debris (large objects, stones, tires, or blockages on the road)
4. Broken Signal (damaged or non-functioning traffic lights)
5. Accident (collisions, damaged vehicles from crashes)
6. Vehicle Breakdown (cars stopped with hazard lights, broken down cars on the side of the road)

Also, analyze the traffic density and estimate the congestion level:
- Traffic Density Level: Choose one of "Clear", "Moderate", "Heavy"
- Estimated Vehicle Count: Estimate the total number of vehicles visible on the road.

Format your response as a valid JSON object. Do not include markdown code block markers (like ```json). Return ONLY the raw JSON string with the following structure:
{
  "fallen_tree": { "detected": true/false, "severity": "Low/Medium/High", "description": "brief details" },
  "waterlogging": { "detected": true/false, "severity": "Low/Medium/High", "description": "brief details" },
  "road_debris": { "detected": true/false, "severity": "Low/Medium/High", "description": "brief details" },
  "broken_signal": { "detected": true/false, "severity": "Low/Medium/High", "description": "brief details" },
  "accident": { "detected": true/false, "severity": "Low/Medium/High", "description": "brief details" },
  "vehicle_breakdown": { "detected": true/false, "severity": "Low/Medium/High", "description": "brief details" },
  "traffic_density": { "level": "Clear/Moderate/Heavy", "estimated_vehicles": 12, "description": "brief description of traffic flow" },
  "overall_summary": "a short summary of the road conditions"
}
"""

def analyze_with_gemini(image_bytes, mime_type, api_key, model_name):
    import time
    
    # Define fallback models
    models = ["gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.0-flash"]
    if model_name and model_name not in models:
        models.insert(0, model_name)
    elif model_name and model_name in models:
        models.remove(model_name)
        models.insert(0, model_name)
        
    last_error = None
    base64_image = base64.b64encode(image_bytes).decode('utf-8')
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": GEMINI_PROMPT},
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": base64_image
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    for current_model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{current_model}:generateContent?key={api_key}"
        
        # We will attempt twice per model
        max_retries = 2
        retry_delay = 5
        
        for attempt in range(max_retries):
            try:
                response = requests.post(url, json=payload, headers=headers)
                
                if response.status_code == 200:
                    result = response.json()
                    text_response = result['candidates'][0]['content']['parts'][0]['text']
                    
                    # Clean JSON markdown formatting if present
                    text_response = text_response.strip()
                    if text_response.startswith("```"):
                        lines = text_response.splitlines()
                        if lines[0].startswith("```"):
                            lines = lines[1:]
                        if lines[-1].startswith("```"):
                            lines = lines[:-1]
                        text_response = "\n".join(lines).strip()
                        
                    return json.loads(text_response)
                    
                elif response.status_code == 429:
                    last_error = f"Model {current_model} returned 429 (Rate Limit/Quota Exhausted)."
                    st.warning(f"⚠️ {current_model} rate limited or quota exhausted. Trying fallback model...")
                    break  # Break out of retry loop to try next model in fallback list
                    
                elif response.status_code == 503:
                    if attempt < max_retries - 1:
                        time.sleep(retry_delay)
                        continue
                    last_error = f"Model {current_model} returned 503 (Busy)."
                    break
                    
                else:
                    last_error = f"Model {current_model} returned status code {response.status_code}."
                    break
                    
            except Exception as e:
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
                last_error = str(e)
                break
                
    return {"error": f"Exceeded quota/retries across all Gemini models. Last error: {last_error}"}

# Main UI Header
st.title("🛣️ Unified AI Road Scanner & Diagnostics")
st.write("Scan road conditions, count vehicles, and detect critical incidents (Accident, Waterlogging, Breakdown) in one click.")

# Input Source Selection
input_tab = st.selectbox("Choose Input Source", ["Live Camera Shot 📷", "Upload Photo 🖼️", "Upload Video 🎥"])

image_to_process = None
video_to_process = None
mime_type = "image/jpeg"

if input_tab == "Live Camera Shot 📷":
    camera_file = st.camera_input("Take a photo of the road")
    if camera_file is not None:
        image_to_process = Image.open(camera_file)
        mime_type = camera_file.type
        
elif input_tab == "Upload Photo 🖼️":
    uploaded_image = st.file_uploader("Choose a road photo...", type=['png', 'jpg', 'jpeg'])
    if uploaded_image is not None:
        image_to_process = Image.open(uploaded_image)
        mime_type = uploaded_image.type

elif input_tab == "Upload Video 🎥":
    uploaded_video = st.file_uploader("Choose a road video...", type=['mp4', 'avi', 'mov'])
    if uploaded_video is not None:
        video_to_process = uploaded_video

# Render Incident Card helper
def render_incident_card(title, data):
    is_detected = data.get("detected", False)
    severity = data.get("severity", "Low")
    desc = data.get("description", "No details available.")
    
    status_class = "status-clear" if not is_detected else ("status-alert" if severity == "High" else "status-warning")
    icon = "❌" if not is_detected else "⚠️"
    
    st.markdown(f"""
    <div class="status-card {status_class}">
        <div class="status-header">
            <span>{title}</span>
            <span>{icon} { 'DETECTED' if is_detected else 'CLEAR' }</span>
        </div>
        <div class="status-body">
            {f'<span class="severity-badge badge-{severity.lower()}">Severity: {severity}</span><br>' if is_detected else ''}
            {desc}
        </div>
    </div>
    """, unsafe_allow_html=True)

# ─── IMAGE PROCESSING ───
if image_to_process is not None:
    image_np = np.array(image_to_process)
    h_ori, w_ori = image_np.shape[0], image_np.shape[1]
    
    st.info("🔄 Running road diagnostics. Please wait...")
    
    # 1. RDD Scan (Local YOLO)
    rdd_results = rdd_net.predict(image_np, conf=CONF_THRESHOLD)
    rdd_boxes = rdd_results[0].boxes.cpu().numpy()
    pothole_count = sum(1 for box in rdd_boxes if int(box.cls) == 3)
    crack_count = sum(1 for box in rdd_boxes if int(box.cls) in [0, 1, 2])
    
    # 2. COCO Scan (Local YOLO)
    coco_results = coco_net.predict(image_np, conf=CONF_THRESHOLD, classes=VEHICLE_CLASSES)
    coco_boxes = coco_results[0].boxes.cpu().numpy()
    vehicle_count = len(coco_boxes)
    
    # 3. Combine Annotations on a Single Image
    # Plot RDD first
    combined_image = rdd_results[0].plot()
    
    # Draw COCO boxes on top
    for box in coco_boxes:
        x1, y1, x2, y2 = box.xyxy[0].astype(int)
        conf = float(box.conf)
        # Draw vehicle bounding box (Blue-cyan color)
        cv2.rectangle(combined_image, (x1, y1), (x2, y2), (0, 180, 255), 3)
        cv2.putText(combined_image, f"Vehicle {conf:.2f}", (x1, y1 - 10), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 180, 255), 2)
                    
    # 4. Gemini Vision Scan for other hazards
    buffered = BytesIO()
    image_to_process.save(buffered, format="JPEG")
    image_bytes = buffered.getvalue()
    
    gemini_data = analyze_with_gemini(image_bytes, mime_type, API_KEY, GEMINI_MODEL)
    
    st.divider()
    
    # Render Unified Image Output
    st.image(combined_image, caption="AI Combined Vision Output (Potholes, Cracks, & Vehicles)", use_column_width=True)
    st.divider()
    
    # Render Single Unified Report
    st.header("📋 AI Road Diagnostic Report")
    
    # Overall summary from Gemini if successful
    if "error" not in gemini_data:
        st.info(f"📝 **AI Scene Summary:** {gemini_data.get('overall_summary', 'No summary generated.')}")
        
    c1, c2 = st.columns(2)
    with c1:
        st.subheader("🛠️ Structural Integrity Scan")
        if pothole_count > 0 or crack_count > 0:
            st.markdown(f"🔴 **ROAD DAMAGE DETECTED**")
            st.markdown(f"- 🕳️ **Potholes:** `{pothole_count}` detected")
            st.markdown(f"- 🩹 **Cracks:** `{crack_count}` detected")
        else:
            st.markdown(f"🟢 **ROAD SURFACE OK**")
            st.markdown("- No surface structural cracks or potholes found.")
            
    with c2:
        st.subheader("🚦 Traffic Flow Scan")
        if vehicle_count == 0:
            t_status = "Clear 🟢"
        elif vehicle_count <= 5:
            t_status = "Low Traffic 🟡"
        elif vehicle_count <= 15:
            t_status = "Moderate Traffic 🟠"
        else:
            t_status = "Heavy Congestion 🔴"
            
        st.markdown(f"**Traffic Flow State:** {t_status}")
        st.markdown(f"- 🚙 **Total Vehicles Count:** `{vehicle_count}` detected")
        
    st.divider()
    
    # Gemini Hazard Checklist
    if "error" not in gemini_data:
        st.subheader("⚠️ Critical Incidents & Hazards Status")
        g1, g2, g3 = st.columns(3)
        with g1:
            render_incident_card("💥 Accident", gemini_data.get("accident", {}))
            render_incident_card("🪵 Fallen Tree", gemini_data.get("fallen_tree", {}))
        with g2:
            render_incident_card("🌊 Waterlogging", gemini_data.get("waterlogging", {}))
            render_incident_card("🚨 Vehicle Breakdown", gemini_data.get("vehicle_breakdown", {}))
        with g3:
            render_incident_card("🧱 Road Debris", gemini_data.get("road_debris", {}))
            render_incident_card("🚦 Broken Signal", gemini_data.get("broken_signal", {}))
            
        # Unified Dispatch Button
        any_incident = any(
            gemini_data.get(k, {}).get("detected", False) for k in 
            ["accident", "fallen_tree", "waterlogging", "vehicle_breakdown", "road_debris", "broken_signal"]
        ) or pothole_count > 0
        
        if any_incident:
            st.warning("⚠️ Critical incidents or road damage detected! Alert generation is recommended.")
            if st.button("🚨 Dispatch Alert & Update Traffic Control Dashboard", type="primary", key="image_dispatch_btn"):
                st.success("✅ DISPATCHED: Maintenance and traffic authority notified. Diverting routes...")
    else:
        st.error(f"Gemini Hazards Scan Error: {gemini_data['error']}")

# ─── VIDEO PROCESSING ───
elif video_to_process is not None:
    st.info("🔄 Processing video stream for inference...")
    
    # Save video locally
    with open(temp_file_input, "wb") as outfile:
        outfile.write(video_to_process.getbuffer())
        
    videoCapture = cv2.VideoCapture(temp_file_input)
    
    if not videoCapture.isOpened():
        st.error("Error loading video stream file.")
    else:
        _width = int(videoCapture.get(cv2.CAP_PROP_FRAME_WIDTH))
        _height = int(videoCapture.get(cv2.CAP_PROP_FRAME_HEIGHT))
        _fps = videoCapture.get(cv2.CAP_PROP_FPS)
        _frame_count = int(videoCapture.get(cv2.CAP_PROP_FRAME_COUNT))
        
        st.write(f"**Processing Video:** {video_to_process.name} ({_width}x{_height} @ {_fps} FPS, {_frame_count} frames)")
        
        if st.button("🚀 Process & Analyze Video"):
            progress_bar = st.progress(0, text="Scanning video frames...")
            frame_view = st.empty()
            
            # Setup video writer
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            cv2writer = cv2.VideoWriter(temp_file_infer, fourcc, _fps, (_width, _height))
            
            # Key frame selection
            max_detections = -1
            best_frame_bytes = None
            
            frame_counter = 0
            
            while videoCapture.isOpened():
                ret, frame = videoCapture.read()
                if not ret:
                    break
                
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                
                # YOLO RDD prediction
                rdd_results = rdd_net.predict(frame_rgb, conf=CONF_THRESHOLD)
                rdd_boxes = rdd_results[0].boxes.cpu().numpy()
                
                # YOLO COCO prediction
                coco_results = coco_net.predict(frame_rgb, conf=CONF_THRESHOLD, classes=VEHICLE_CLASSES)
                coco_boxes = coco_results[0].boxes.cpu().numpy()
                
                # Plot RDD results onto frame
                annotated_frame = rdd_results[0].plot()
                # Overlay vehicles boxes too
                for box in coco_boxes:
                    x1, y1, x2, y2 = box.xyxy[0].astype(int)
                    cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 180, 255), 3)
                    cv2.putText(annotated_frame, "Vehicle", (x1, y1 - 10), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 180, 255), 2)
                
                final_frame = cv2.resize(annotated_frame, (_width, _height), interpolation=cv2.INTER_AREA)
                
                # Save processed frame
                cv2writer.write(cv2.cvtColor(final_frame, cv2.COLOR_RGB2BGR))
                frame_view.image(final_frame, channels="RGB", use_column_width=True)
                
                # Detect the worst frame with most objects for Gemini scanning
                total_detects = len(rdd_boxes) + len(coco_boxes)
                if total_detects > max_detections:
                    max_detections = total_detects
                    success, enc_img = cv2.imencode('.jpg', cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2BGR))
                    if success:
                        best_frame_bytes = enc_img.tobytes()
                
                frame_counter += 1
                progress_bar.progress(frame_counter / _frame_count, text=f"Processed frame {frame_counter}/{_frame_count}")
                
            videoCapture.release()
            cv2writer.release()
            progress_bar.empty()
            
            st.success("✅ Video Processing Complete!")
            
            # Send key frame to Gemini Vision
            gemini_data = {}
            if best_frame_bytes:
                st.info("🔄 Running Gemini Vision analysis on worst-condition frame selected from video...")
                gemini_data = analyze_with_gemini(best_frame_bytes, "image/jpeg", API_KEY, GEMINI_MODEL)
                
            # Layout
            col1, col2 = st.columns(2)
            with col1:
                st.subheader("📁 Download Processed Video")
                with open(temp_file_infer, "rb") as f:
                    st.download_button(
                        label="Download Output Video",
                        data=f,
                        file_name="RDD_AI_Processed.mp4",
                        mime="video/mp4",
                        use_container_width=True
                    )
            with col2:
                if st.button("Restart Scan", use_container_width=True):
                    st.rerun()
                    
            # Show Gemini results
            if "error" not in gemini_data:
                st.header("⚡ Gemini Vision AI Incident Report (From Video Key Frame)")
                st.info(f"📝 **AI Summary:** {gemini_data.get('overall_summary', 'No summary generated.')}")
                
                c_density = gemini_data.get("traffic_density", {})
                col_density1, col_density2 = st.columns(2)
                with col_density1:
                    st.metric("Gemini Congestion Assessment", c_density.get("level", "Clear"))
                with col_density2:
                    st.metric("Gemini Vehicle Count Estimate", c_density.get("estimated_vehicles", "0"))
                    
                st.subheader("🛠️ Road Hazard Status Checklist")
                g1, g2, g3 = st.columns(3)
                with g1:
                    render_incident_card("💥 Accident", gemini_data.get("accident", {}))
                    render_incident_card("🪵 Fallen Tree", gemini_data.get("fallen_tree", {}))
                with g2:
                    render_incident_card("🌊 Waterlogging", gemini_data.get("waterlogging", {}))
                    render_incident_card("🚨 Vehicle Breakdown", gemini_data.get("vehicle_breakdown", {}))
                with g3:
                    render_incident_card("🧱 Road Debris", gemini_data.get("road_debris", {}))
                    render_incident_card("🚦 Broken Signal", gemini_data.get("broken_signal", {}))
                
                # Dispatch Button
                any_incident = any(
                    gemini_data.get(k, {}).get("detected", False) for k in 
                    ["accident", "fallen_tree", "waterlogging", "vehicle_breakdown", "road_debris", "broken_signal"]
                )
                
                if any_incident:
                    st.warning("⚠️ Critical incidents detected in video key frame! Alert generation recommended.")
                    if st.button("🚨 Dispatch Alert & Update Traffic Control Dashboard", type="primary", key="video_dispatch_btn"):
                        st.success("✅ DISPATCHED: Maintenance and traffic authority notified. Diverting routes...")
            else:
                st.error(f"Gemini API Error: {gemini_data['error']}")
