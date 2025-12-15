# Arrohan 2025: Intelligent Hazard Detection System

Arrohan is a real-time hazard detection system powered by YOLOv8/YOLO11, designed to identify community issues such as **car crashes**, **fallen trees**, **trash**, and **potholes** using live video feeds from webcams or mobile phones.

## Features

- **Real-Time Detection:** Processes video streams at 30+ FPS on Apple Silicon (M1/M2/M3).
- **Dual Camera Modes:**
  - **Webcam Mode:** Uses the default computer webcam.
  - **Phone Mode:** Connects to any mobile phone running an IP Camera app.
- **Custom Model:** Trained specifically for civic hazards (Trash, Potholes, Accidents, etc.).
- **Live Dashboard:** Web-based interface to view live video and real-time incident logs.
- **Optimized for Mac:** Fully utilizes Apple Metal Performance Shaders (MPS) for acceleration.

## Setup

### Prerequisites
- Python 3.9+
- A webcam OR a smartphone

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd Arrohan_2025
    ```

2.  **Create and Activate Virtual Environment:**
    ```bash
    python -m venv .venv
    source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
    ```

3.  **Install Dependencies:**
    ```bash
    pip install ultralytics flask flask-socketio flask-cors opencv-python pillow
    ```

## Usage

### 1. Standard Webcam Mode
Use this to run detections using your laptop's built-in webcam.

```bash
python src/server.py
```
*   **Dashboard:** Open `http://127.0.0.1:5500` in your browser.

### 2. Phone Camera Mode
Use your iPhone or Android device as a high-quality wireless camera.

1.  **Phone Setup:**
    *   Download **"IP Camera Lite"** (iOS) or **"IP Webcam"** (Android).
    *   Connect phone and computer to the **same Wi-Fi**.
    *   Start the stream and note the URL (e.g., `http://192.168.1.X:8080/video`).

2.  **Configure Script:**
    *   Open `src/hand_server.py`.
    *   Update `CAMERA_URL` with your phone's specific URL.

3.  **Run Server:**
    ```bash
    python src/hand_server.py
    ```

## Training Custom Models

To retrain the model with new data for better accuracy:

1.  **Prepare Data:**
    *   Place your dataset (images and labels) in `data/custom_dataset`.
    *   Ensure `data/custom_dataset/data.yaml` is correctly configured.

2.  **Run Training:**
    ```bash
    python src/scripts/train.py
    ```
    *   This script is optimized for Apple Silicon (MPS).
    *   It defaults to 100 epochs with the "Small" YOLO model (`yolov8s.pt`) for the best balance of speed and accuracy.

3.  **Deploy New Model:**
    *   After training, the script saves the best model to `experiments/YOLOv8_Training/Arrohan_Custom_Best/weights/best.pt`.
    *   Copy this file to `models/Arrohan_Custom_Best.pt` to use it in the live server.

## Project Structure

```
Arrohan_2025/
├── src/
│   ├── server.py           # Main server (Webcam)
│   ├── hand_server.py      # Phone Camera server
│   └── scripts/
│       ├── train.py        # Training script
│       └── predict.py      # Standalone prediction script
├── frontend/               # Web Dashboard (HTML/JS/CSS)
├── data/                   # Datasets and Logs
├── models/                 # Trained YOLO weights (.pt)
└── output/                 # Saved screenshots of detections
```

