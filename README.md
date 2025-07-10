# Weed Detection App

AI-powered weed detection application using Roboflow API and React.

## Features

- 🖼️ Image upload with drag-and-drop support
- 🤖 AI-powered weed detection using Roboflow
- 📊 Visual annotation with bounding boxes
- 📱 Responsive design for all devices
- 📥 Download annotated images
- 🎯 Real-time detection results

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## API Configuration

The app uses Roboflow's weed detection model:
- Model: weed-detection-in-a-field/1
- Endpoint: https://detect.roboflow.com/weed-detection-in-a-field/1

## Usage

1. Upload an image by dragging and dropping or clicking "Choose File"
2. Click "Run" to detect weeds in the image
3. View detection results with confidence scores
4. Download the annotated image with bounding boxes

## Technologies

- React 18
- TypeScript
- Tailwind CSS
- Vite
- Roboflow API
- Canvas API for image annotation