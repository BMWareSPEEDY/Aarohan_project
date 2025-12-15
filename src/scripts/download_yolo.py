from ultralytics import YOLO

# This line downloads yolov8n.pt if it is not already available
model = YOLO('yolov8s.pt') 

print("yolov8s.pt has been downloaded and loaded successfully!")
