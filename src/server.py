import os
import json
import base64
import time
import threading
from datetime import datetime
from io import BytesIO

import cv2
import numpy as np
from flask import Flask, jsonify, send_from_directory, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from PIL import Image
from ultralytics import YOLO

# ======================== CONFIGURATION ========================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, 'models', 'Arrohan_Custom_Best.pt')
STATIC_FOLDER = os.path.join(BASE_DIR, 'frontend')
DETECTIONS_FILE = os.path.join(BASE_DIR, 'data', 'detections.json')
OUTPUT_DIR = os.path.join(BASE_DIR, 'output')

# Detection settings
CONFIDENCE_THRESHOLD = 0.7
COOLDOWN_SECONDS = 2
TARGET_FPS = 30  # Target frame rate for streaming (15-30 FPS)
FRAME_INTERVAL = 1.0 / TARGET_FPS

# ======================== FLASK SETUP ========================

app = Flask(__name__, static_folder=STATIC_FOLDER)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# ======================== GLOBAL STATE ========================

detections_db = []
detection_lock = threading.Lock()
detection_counter = 0
last_save_time = 0
model = None
camera_thread = None
stop_event = threading.Event()

# ======================== HELPER FUNCTIONS ========================

def load_detections():
    """Load detections from JSON file"""
    global detections_db
    if os.path.exists(DETECTIONS_FILE):
        try:
            with open(DETECTIONS_FILE, 'r') as f:
                detections_db = json.load(f)
            print(f"Loaded {len(detections_db)} detections from {DETECTIONS_FILE}")
        except Exception as e:
            print(f"Error loading detections: {e}")
            detections_db = []
    else:
        detections_db = []

def save_detections():
    """Save detections to JSON file"""
    try:
        with open(DETECTIONS_FILE, 'w') as f:
            json.dump(detections_db, f, indent=2)
    except Exception as e:
        print(f"Error saving detections: {e}")

def add_detection(detection_data):
    """Add a new detection to the database"""
    global detection_counter
    with detection_lock:
        detection_counter += 1
        detection_data['id'] = detection_counter
        detections_db.append(detection_data)
        save_detections()
    return detection_data

def encode_frame_to_base64(frame):
    """Convert OpenCV frame to base64-encoded JPEG"""
    try:
        # Convert BGR to RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        # Convert to PIL Image
        pil_img = Image.fromarray(frame_rgb)
        # Encode as JPEG
        buffer = BytesIO()
        pil_img.save(buffer, format='JPEG', quality=85)
        # Convert to base64
        img_str = base64.b64encode(buffer.getvalue()).decode('utf-8')
        return f"data:image/jpeg;base64,{img_str}"
    except Exception as e:
        print(f"Error encoding frame: {e}")
        return None

# ======================== DETECTION LOOP ========================

def detection_loop():
    """Main detection loop running in background thread"""
    global model, last_save_time
    
    print("Starting detection loop...")
    
    # Load model
    if not os.path.exists(MODEL_PATH):
        print(f"Model not found at {MODEL_PATH}")
        return
    
    model = YOLO(MODEL_PATH)
    print("Model loaded successfully")
    
    # Open webcam
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open webcam")
        return
    
    print(f"Webcam opened. Streaming at {TARGET_FPS} FPS")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    frame_count = 0
    
    try:
        while not stop_event.is_set():
            start_time = time.time()
            
            # Read frame
            ret, frame = cap.read()
            if not ret:
                print("Failed to read frame")
                break
            
            # Run inference
            results = model.predict(source=frame, save=False, verbose=False)
            
            # Get annotated frame
            annotated_frame = results[0].plot()
            
            # Encode frame for streaming
            frame_base64 = encode_frame_to_base64(annotated_frame)
            
            if frame_base64:
                # Emit frame to all connected clients
                socketio.emit('video_frame', {'frame': frame_base64}, namespace='/')
            
            # Check for high-confidence detections
            current_time = time.time()
            if results[0].boxes is not None and len(results[0].boxes) > 0:
                max_confidence = float(results[0].boxes.conf.max())
                
                if max_confidence >= CONFIDENCE_THRESHOLD:
                    # Check cooldown
                    if current_time - last_save_time >= COOLDOWN_SECONDS:
                        # Save screenshot
                        screenshot_filename = f'detection_{frame_count}_conf{max_confidence:.2f}.jpg'
                        screenshot_path = os.path.join(OUTPUT_DIR, screenshot_filename)
                        cv2.imwrite(screenshot_path, annotated_frame)
                        
                        # Extract detection info
                        boxes = results[0].boxes
                        detected_class = int(boxes.cls[boxes.conf.argmax()])
                        class_name = model.names[detected_class]
                        
                        # Create detection record
                        detection_data = {
                            'type': class_name,
                            'severity': 'Critical' if max_confidence >= 0.9 else 'High' if max_confidence >= 0.8 else 'Medium',
                            'status': 'Open',
                            'zone': 'Camera-1',
                            'detectedAt': datetime.now().isoformat(),
                            'drone': 'Webcam-YOLO',
                            'evidenceUrl': f'/output/{screenshot_filename}',
                            'confidence': round(max_confidence, 2)
                        }
                        
                        # Save to database
                        saved_detection = add_detection(detection_data)
                        
                        # Emit detection event
                        socketio.emit('new_detection', saved_detection, namespace='/')
                        
                        print(f"[{frame_count}] Detection: {class_name} ({max_confidence:.2f}) - Saved to {screenshot_filename}")
                        
                        frame_count += 1
                        last_save_time = current_time
            
            # Maintain target frame rate
            elapsed = time.time() - start_time
            sleep_time = max(0, FRAME_INTERVAL - elapsed)
            time.sleep(sleep_time)
            
    except Exception as e:
        print(f"Error in detection loop: {e}")
    finally:
        cap.release()
        print("Webcam released")

# ======================== ROUTES ========================

@app.route('/')
def index():
    """Serve the main HTML page"""
    return send_from_directory(STATIC_FOLDER, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files"""
    return send_from_directory(STATIC_FOLDER, path)

@app.route('/output/<path:filename>')
def serve_output(filename):
    """Serve detection screenshots"""
    return send_from_directory(OUTPUT_DIR, filename)

@app.route('/api/incidents')
def get_incidents():
    """REST API endpoint for fetching incidents (backward compatibility)"""
    place_id = request.args.get('place_id', 'default')
    
    with detection_lock:
        incidents = list(detections_db)
    
    return jsonify({'incidents': incidents, 'place_id': place_id})

# ======================== SOCKET.IO EVENTS ========================

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    print('Client connected')
    emit('connection_status', {'status': 'connected', 'message': 'Connected to detection server'})
    
    # Send current statistics
    with detection_lock:
        stats = {
            'total_detections': len(detections_db),
            'critical_open': len([d for d in detections_db if d['severity'] == 'Critical' and d['status'] != 'Resolved'])
        }
    emit('detection_stats', stats)

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print('Client disconnected')

@socketio.on('request_history')
def handle_history_request():
    """Send all historical detections to client"""
    with detection_lock:
        emit('detection_history', {'incidents': list(detections_db)})

# ======================== STARTUP ========================

def start_camera_thread():
    """Start the detection loop in a background thread"""
    global camera_thread
    camera_thread = threading.Thread(target=detection_loop, daemon=True)
    camera_thread.start()

if __name__ == '__main__':
    print("=" * 60)
    print("YOLO Real-Time Detection Server")
    print("=" * 60)
    
    # Load existing detections
    load_detections()
    
    # Start detection thread
    start_camera_thread()
    
    # Start Flask-SocketIO server
    print(f"Server starting on http://127.0.0.1:5500")
    print(f"Streaming at {TARGET_FPS} FPS with confidence threshold {CONFIDENCE_THRESHOLD}")
    print("=" * 60)
    
    socketio.run(app, host='127.0.0.1', port=5500, debug=False, allow_unsafe_werkzeug=True)
