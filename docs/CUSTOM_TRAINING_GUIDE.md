# How to Train Your Own Custom Model

This guide explains how to replace the existing model with one trained on your own images from the `attachments/` folder.

## Prerequisite: Clear Old Data (Optional)

If you want to remove the old images and model references:

1. **Delete old datasets**: You can remove the folders inside `data/` if you don't need them.
2. **Archive old model**: The current model is at `experiments/YOLOv8-Training/Arrohan_Project_Run/weights/best.pt`. You don't need to delete it, but you will stop using it in the final step.

---

## Phase 1: Annotate Your Images

Since your images in `attachments/` are not annotated (they are just raw JPGs), you need to draw boxes around the objects you want to detect.

### Option A: Use Roboflow (Recommended for ease of use)
Roboflow is a web-based tool that makes this very easy and handles the complex file formatting for you.

1.  **Create an Account**: Go to [roboflow.com](https://roboflow.com) and sign up (free tier is fine).
2.  **Create a Project**: 
    *   Project Type: **Object Detection**
    *   Name: "Arrohan-Custom" (or similar)
3.  **Upload Images**:
    *   Drag and drop all 81 images from your `attachments` folder into the upload window.
    *   Click "Save and Continue".
4.  **Annotate**:
    *   Click "Start Annotating".
    *   For every image:
        *   Draw a box around the object (e.g., person, car, item).
        *   Type the class name (e.g., `drone`, `person`). **Be consistent!**
    *   Mark images as "Done" when finished.
5.  **Generate Version**:
    *   Click "Generate" on the sidebar.
    *   (Optional) Add a "Resize" preprocessing step to **640x640** (Standard for YOLO).
    *   Click "Generate".
6.  **Export**:
    *   Click "Export Dataset".
    *   Format: Select **YOLOv8**.
    *   Select "Download zip to computer".
    *   Unzip the folder and rename it to `custom_dataset`. Move it into your project folder: `/Users/ashishpaliwal/PycharmProjects/Arrohan_2025/custom_dataset`.

### Option B: Use LabelImg (Local tool)
If you prefer not to upload photos to the cloud.

1.  **Install**: `pip install labelImg`
2.  **Run**: Type `labelImg` in your terminal.
3.  **Setup**:
    *   "Open Dir": Select your `attachments` folder.
    *   "Change Save Dir": Create a new folder `attachments/labels` and select it.
    *   **Important**: On the left toolbar, click "PascalVOC" until it says **"YOLO"**.
4.  **Annotate**:
    *   Press `w` to draw a box.
    *   Label the object.
    *   Press `d` to save and go to next image.
5.  **Organize Files**:
    *   You will need to manually organize folders into `train/images`, `train/labels`, `val/images`, `val/labels` and create a `data.yaml` file. (Roboflow does this automatically, which is why Option A is recommended).

---

## Phase 2: Train the Model

Once you have your dataset (let's assume you used Roboflow and have a folder `custom_dataset` with a `data.yaml` inside), you can start training.

1.  **Open Terminal** in your project folder.
2.  **Activate Virtual Environment**:
    ```bash
    source .venv/bin/activate
    ```
3.  **Run Training Command**:
    Replace `/path/to/custom_dataset/data.yaml` with the actual path to your `data.yaml` file.
    
    ```bash
    yolo task=detect mode=train model=yolov8n.pt data=/Users/ashishpaliwal/PycharmProjects/Arrohan_2025/custom_dataset/data.yaml epochs=50 imgsz=640 name=My_Custom_Run
    ```
    
    *   `model=yolov8n.pt`: Uses the base YOLOv8 model (Nano version, fastest).
    *   `epochs=50`: How many times to cycle through the data.
    *   `name=My_Custom_Run`: The name of the output folder.

4.  **Wait**: Training might take 15-30 minutes on a CPU, or faster if you have a GPU.

---

## Phase 3: Switch to the New Model

After training finishes, the tool will tell you where the best model is saved. It usually looks like this:
`runs/detect/My_Custom_Run/weights/best.pt`

1.  **Update server.py**:
    *   Open `server.py`.
    *   Find line 19 (`MODEL_PATH`).
    *   Change it to point to your new key.
    
    ```python
    # OLD
    # MODEL_PATH = '/.../experiments/YOLOv8-Training/Arrohan_Project_Run/weights/best.pt'
    
    # NEW
    MODEL_PATH = '/Users/ashishpaliwal/PycharmProjects/Arrohan_2025/runs/detect/My_Custom_Run/weights/best.pt'
    ```

2.  **Restart Server**:
    *   Stop the running server (Ctrl+C).
    *   Run `python server.py`.

Your dashboard will now detect the objects you annotated!
