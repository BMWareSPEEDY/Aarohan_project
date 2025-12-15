import os
import cv2
from ultralytics import YOLO
import glob

def main():
    # --- Model and Data Paths ---
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    model_path = os.path.join(BASE_DIR, 'models', 'custom_best.pt')
    
    # Directory to save screenshots
    output_dir = os.path.join(BASE_DIR, 'output')
    os.makedirs(output_dir, exist_ok=True)

    # --- Configuration ---
    CONFIDENCE_THRESHOLD = 0.6  # Minimum confidence to trigger screenshot
    COOLDOWN_SECONDS = 2  # Seconds to wait between screenshots
    
    # --- Load Model ---
    if not os.path.exists(model_path):
        print(f"Model not found at {model_path}. Please check the path.")
        return
        
    print(f"Loading model from {model_path}")
    model = YOLO(model_path)

    # --- Open Webcam ---
    print("Opening webcam...")
    cap = cv2.VideoCapture(0)  # 0 is the default webcam
    
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        return
    
    print("Webcam opened successfully!")
    print(f"Running autonomous detection mode (confidence threshold: {CONFIDENCE_THRESHOLD})")
    print("High-confidence detections will be automatically saved.")
    print("Press 'q' to quit")
    
    frame_count = 0
    last_save_time = 0
    
    try:
        while True:
            # Read frame from webcam
            ret, frame = cap.read()
            
            if not ret:
                print("Error: Failed to read frame from webcam.")
                break
            
            # Run inference on the frame
            results = model.predict(source=frame, save=False, verbose=False)
            
            # Get the annotated frame for display
            annotated_frame = results[0].plot()
            
            # Add status text to the frame
            cv2.putText(annotated_frame, "Press 'q' to quit | Auto-saving high confidence detections", 
                       (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            
            # Display the frame
            cv2.imshow('YOLO Webcam Detection', annotated_frame)
            
            # Check for high-confidence detections
            import time
            current_time = time.time()
            
            if results[0].boxes is not None and len(results[0].boxes) > 0:
                # Get the maximum confidence from all detections
                max_confidence = float(results[0].boxes.conf.max())
                
                if max_confidence >= CONFIDENCE_THRESHOLD:
                    # Check cooldown before saving
                    if current_time - last_save_time >= COOLDOWN_SECONDS:
                        # Save screenshot
                        screenshot_path = os.path.join(output_dir, f'detection_{frame_count}_conf{max_confidence:.2f}.jpg')
                        cv2.imwrite(screenshot_path, annotated_frame)
                        print(f"[{frame_count}] High confidence detection ({max_confidence:.2f}) - Screenshot saved: {screenshot_path}")
                        
                        frame_count += 1
                        last_save_time = current_time
            
            # Handle keyboard input
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                print("Quitting...")
                break
                
    except KeyboardInterrupt:
        print("\nStopping...")
        
    finally:
        # Release resources
        cap.release()
        cv2.destroyAllWindows()
        print(f"Session complete. {frame_count} screenshots saved to '{output_dir}/' directory.")
        print("Webcam released and windows closed.")

if __name__ == '__main__':
    main()
