"""
Gemini Vision Analyzer
======================
Detects road hazards using Gemini 1.5 Flash multimodal AI.

Supported detection categories:
  1. Fallen Trees
  2. Flood / Waterlogging
  3. Road Debris
  4. Broken / Damaged Traffic Signal
  5. Accident Scene

Usage:
    from ml_models.gemini_vision.analyzer import GeminiVisionAnalyzer
    analyzer = GeminiVisionAnalyzer(api_key="YOUR_KEY")
    result = analyzer.analyze_image("path/to/image.jpg")
"""

import os
import json
import base64
import time
from pathlib import Path
from typing import Union
from PIL import Image
import google.generativeai as genai

# ──────────────────────────────────────────────
# CONFIGURE YOUR API KEY HERE (or set env var)
# ──────────────────────────────────────────────
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "YOUR_GEMINI_API_KEY_HERE")

# Detection categories
HAZARD_CATEGORIES = [
    "fallen_tree",
    "flood",
    "road_debris",
    "broken_signal",
    "accident_scene",
    "pothole",
    "traffic_jam",
]

# Structured prompt for Gemini
ANALYSIS_PROMPT = """
You are an expert traffic surveillance AI. Analyze this road/traffic image and detect the following hazards:

1. **Fallen Tree** - Any tree fallen across or near the road blocking or threatening traffic
2. **Flood / Waterlogging** - Standing water, flooded roads, or waterlogged areas
3. **Road Debris** - Scattered debris, rocks, gravel, construction material, or obstacles on road
4. **Broken / Damaged Signal** - Traffic signals that are damaged, tilted, off, or malfunctioning
5. **Accident Scene** - Vehicle collision, overturned vehicles, damaged vehicles, or accident aftermath
6. **Pothole** - Any potholes, deep road cracks, or severe road surface damage that can cause vehicle damage or accidents
7. **Traffic Jam** - Severe traffic congestion, standstill traffic, or very high vehicle density

Respond ONLY in the following strict JSON format — no extra text:
{
  "detections": [
    {
      "category": "<one of: fallen_tree | flood | road_debris | broken_signal | accident_scene | pothole | traffic_jam>",
      "detected": <true | false>,
      "confidence": <0.0 to 1.0>,
      "severity": "<low | medium | high | critical>",
      "description": "<1-2 sentence description of what you see>",
      "recommended_action": "<brief action for traffic control center>"
    }
  ],
  "overall_risk": "<safe | low | moderate | high | critical>",
  "requires_immediate_action": <true | false>,
  "scene_summary": "<overall 1-sentence summary of the road scene>",
  "estimated_vehicle_count": <integer estimate of vehicles visible>
}

Only include categories in the 'detections' list where hazard is actually detected (detected=true). Do NOT include categories where detected=false.
"""


class GeminiVisionAnalyzer:
    """
    Gemini Vision-powered road hazard detector.
    Analyzes images for fallen trees, floods, debris, broken signals, accidents.
    """

    def __init__(self, api_key: str = None):
        key = api_key or GEMINI_API_KEY
        if key == "YOUR_GEMINI_API_KEY_HERE":
            raise ValueError(
                "Please set your Gemini API key!\n"
                "Option 1: Set env var: set GEMINI_API_KEY=your_key\n"
                "Option 2: Pass api_key= to GeminiVisionAnalyzer()"
            )
        genai.configure(api_key=key)
        self.model = genai.GenerativeModel("gemini-2.5-flash")
        print("[Gemini] Gemini Vision Analyzer initialized (gemini-2.5-flash)")

    def analyze_image(self, image_source: Union[str, bytes, Image.Image]) -> dict:
        """
        Analyze a road image for hazards.

        Args:
            image_source: File path (str), raw bytes, or PIL Image

        Returns:
            dict with full detection results
        """
        img = self._load_image(image_source)
        start = time.time()

        try:
            response = self.model.generate_content(
                [ANALYSIS_PROMPT, img],
                generation_config=genai.types.GenerationConfig(
                    temperature=0.1,        # Low temp = consistent structured output
                    max_output_tokens=2048,
                )
            )
            elapsed = round(time.time() - start, 2)
            result = self._parse_response(response.text)
            result["analysis_time_seconds"] = elapsed
            result["model"] = "gemini-2.5-flash"
            return result

        except Exception as e:
            return {
                "error": str(e),
                "detections": [],
                "overall_risk": "unknown",
                "requires_immediate_action": False,
                "scene_summary": "Analysis failed",
                "model": "gemini-2.5-flash"
            }

    def analyze_from_base64(self, b64_string: str, mime_type: str = "image/jpeg") -> dict:
        """Analyze image from base64 string (useful for API endpoints)."""
        img_bytes = base64.b64decode(b64_string)
        return self.analyze_image(img_bytes)

    def get_alerts(self, analysis_result: dict) -> list[dict]:
        """
        Extract actionable alerts from analysis result.
        Returns list of alerts for the dashboard.
        """
        alerts = []
        for detection in analysis_result.get("detections", []):
            if detection.get("detected") and detection.get("confidence", 0) >= 0.5:
                alerts.append({
                    "type": detection["category"].replace("_", " ").title(),
                    "severity": detection.get("severity", "medium"),
                    "confidence": f"{int(detection.get('confidence', 0) * 100)}%",
                    "description": detection.get("description", ""),
                    "action": detection.get("recommended_action", ""),
                    "requires_immediate_action": analysis_result.get("requires_immediate_action", False),
                })
        return alerts

    # ──────────────────────────────────────────────
    # Private helpers
    # ──────────────────────────────────────────────

    def _load_image(self, source: Union[str, bytes, Image.Image]) -> Image.Image:
        """Convert any image source to PIL Image."""
        if isinstance(source, Image.Image):
            return source
        if isinstance(source, (str, Path)):
            return Image.open(source).convert("RGB")
        if isinstance(source, bytes):
            import io
            return Image.open(io.BytesIO(source)).convert("RGB")
        raise ValueError(f"Unsupported image source type: {type(source)}")

    def _parse_response(self, text: str) -> dict:
        """Extract and parse JSON from Gemini response."""
        text = text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Fallback: return raw text in structured form
            return {
                "raw_response": text,
                "detections": [],
                "overall_risk": "unknown",
                "requires_immediate_action": False,
                "scene_summary": "Could not parse structured response",
            }


# ──────────────────────────────────────────────
# Quick test (run this file directly)
# ──────────────────────────────────────────────
if __name__ == "__main__":
    import sys

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: Please set GEMINI_API_KEY environment variable first.")
        print("  Windows: set GEMINI_API_KEY=your_key_here")
        sys.exit(1)

    analyzer = GeminiVisionAnalyzer(api_key=api_key)

    # Test with a sample image if path provided, else use a test URL
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        print(f"\n🔍 Analyzing: {image_path}")
        result = analyzer.analyze_image(image_path)
    else:
        print("\n⚠️  No image path provided. Pass an image path as argument:")
        print("   python analyzer.py path/to/road_image.jpg")
        sys.exit(0)

    print("\n📊 ANALYSIS RESULT:")
    print(json.dumps(result, indent=2))

    print("\n🚨 ALERTS:")
    alerts = analyzer.get_alerts(result)
    if alerts:
        for a in alerts:
            print(f"  [{a['severity'].upper()}] {a['type']} — {a['confidence']} confidence")
            print(f"    → {a['action']}")
    else:
        print("  ✅ No hazards detected")
