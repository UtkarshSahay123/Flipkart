import cv2
from ultralytics import YOLO

def start_traffic_monitoring(source=0):
    """
    Real-time Traffic Density Monitoring and Vehicle Counting.
    source=0 for Webcam, or provide a path to a video file.
    """
    # Load pre-trained YOLO model (detects 80 classes including cars/trucks)
    try:
        model = YOLO('yolo11n.pt') 
    except:
        model = YOLO('yolov8n.pt')

    # Define vehicle class IDs in COCO dataset
    # 2: car, 3: motorcycle, 5: bus, 7: truck
    vehicle_classes = [2, 3, 5, 7]

    cap = cv2.VideoCapture(source)
    print("--- Traffic Density Monitoring Started ---")

    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break

        # Run YOLO detection with class filtering
        results = model(frame, classes=vehicle_classes, verbose=False)
        
        # Count vehicles in current frame
        vehicle_count = len(results[0].boxes)
        
        # Determine Density Status
        if vehicle_count < 5:
            density = "LOW"
            color = (0, 255, 0) # Green
        elif vehicle_count < 15:
            density = "MEDIUM"
            color = (0, 255, 255) # Yellow
        else:
            density = "HIGH"
            color = (0, 0, 255) # Red

        # Annotate Frame
        annotated_frame = results[0].plot()
        cv2.putText(annotated_frame, f"Vehicles: {vehicle_count}", (20, 50), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        cv2.putText(annotated_frame, f"Density: {density}", (20, 100), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1, color, 3)

        # Show result
        cv2.imshow("Smart City Traffic Monitor", annotated_frame)

        # Break on 'q' key
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    # To test with a video, replace 0 with 'path/to/video.mp4'
    start_traffic_monitoring(source=0)
