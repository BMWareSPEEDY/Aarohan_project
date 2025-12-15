import os
import shutil
from roboflow import Roboflow
from ultralytics import YOLO

def main():
    # --- Configuration ---
    # Path to your local custom dataset
    DATASET_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'data', 'custom_dataset')
    DATA_YAML_PATH = os.path.join(DATASET_DIR, 'data.yaml')
    
    # Model selection: 'yolov8s.pt' (Small) offers a great balance of speed/accuracy for M1 Pro.
    # Use 'yolov8m.pt' for higher accuracy if FPS allows, or 'yolov8n.pt' for max speed.
    MODEL_NAME = 'yolov8s.pt' 
    MODEL_PATH = os.path.join('models', MODEL_NAME)

    # --- Verification ---
    if not os.path.exists(DATA_YAML_PATH):
        print(f"Error: dataset configuration not found at {DATA_YAML_PATH}")
        print("Please ensure your dataset is correctly placed in 'data/custom_dataset'")
        return

    print(f"Using dataset configuration: {DATA_YAML_PATH}")

    # --- Model Setup ---
    # Ensure model directory exists
    os.makedirs('models', exist_ok=True)
    
    print(f"Loading model: {MODEL_NAME}")
    # This will automatically download the model if not present locally
    model = YOLO(MODEL_NAME)

    print("Starting training for maximum accuracy...")
    print("Configuration: 100 Epochs, Image Size 640, Patience 50")

    try:
        results = model.train(
            data=DATA_YAML_PATH,
            epochs=30,           # Increased for max accuracy
            patience=50,          # Stop if no improvement for 50 epochs
            imgsz=640,            # Standard resolution
            batch=16,             # Adjust based on M1 memory availability
            project="experiments/YOLOv8_Training",
            name="Arrohan_Custom_Best",
            exist_ok=True,        # Overwrite content in the experiment folder if it exists
            device='mps',         # Use Apple Silicon GPU acceleration
            save=True             # Save standard checkpoints
        )
        print("Training successfully completed.")
        print(f"Your trained model and results are saved in: {results.save_dir}")
        print(f"Best model path: {os.path.join(results.save_dir, 'weights', 'best.pt')}")
        
    except Exception as e:
        print(f"An error occurred during model training: {e}")

if __name__ == '__main__':
    main()