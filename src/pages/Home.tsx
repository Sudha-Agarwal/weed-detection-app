import { useState, useRef } from "react";
import {
  Upload,
  CloudUpload,
  CheckCircle,
  AlertTriangle,
  Download,
  Plus,
  Loader2,
  Play,
  Camera,
} from "lucide-react";

// UI Components
const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-lg border shadow-sm ${className}`}>{children}</div>
);
const CardContent = ({ children, className = "" }) => (
  <div className={`p-6 ${className}`}>{children}</div>
);
const Button = ({ children, onClick, disabled = false, className = "" }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center justify-center px-4 py-2 rounded-md font-medium transition-colors ${
      disabled ? "opacity-50 cursor-not-allowed" : "hover:opacity-90"
    } ${className}`}
  >
    {children}
  </button>
);
const Alert = ({ children, className = "" }) => (
  <div className={`border rounded-md p-4 ${className}`}>{children}</div>
);
const AlertDescription = ({ children, className = "" }) => (
  <div className={`text-sm ${className}`}>{children}</div>
);

// Toast
const toast = ({ title, description, variant = "default" }) => {
  const toastEl = document.createElement("div");
  toastEl.className = `fixed top-4 right-4 bg-white border rounded-md p-4 shadow-lg z-50 ${
    variant === "destructive" ? "border-red-500 bg-red-50" : "border-green-500 bg-green-50"
  }`;
  toastEl.innerHTML = `
    <div class="font-medium">${title}</div>
    <div class="text-sm text-gray-600">${description}</div>
  `;
  document.body.appendChild(toastEl);
  setTimeout(() => toastEl.remove(), 3000);
};
export default function Home() {
  const [imageData, setImageData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [apiResults, setApiResults] = useState(null);
  const [annotatedImageUrl, setAnnotatedImageUrl] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [liveDetectionInterval, setLiveDetectionInterval] = useState(null);
const [cameraFacing, setCameraFacing] = useState("environment");

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const liveCanvasRef = useRef(null);
  const canvasRef = useRef(null);

const resetAll = () => {
  setImageData(null);
  setApiResults(null);
  setAnnotatedImageUrl(null);
  setError(null);
  const canvas = liveCanvasRef.current;
  if (canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
};

  const handleFile = (file) => {
    resetAll();
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const maxSize = 10 * 1024 * 1024;
    if (!allowedTypes.includes(file.type)) return setError("Invalid file type");
    if (file.size > maxSize) return setError("File too large (max 10MB)");
    setError(null);
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageData({
        file,
        url: e.target.result,
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        type: file.type,
      });
      setIsLoading(false);
      toast({ title: "Success", description: "Image uploaded" });
    };
    reader.readAsDataURL(file);
  };

  const handleRun = async () => {
    resetAll();
    if (!imageData) return toast({ title: "No image", description: "Upload first", variant: "destructive" });
    setIsRunning(true);
    try {
      const base64Image = imageData.url.split(",")[1];
      const apiUrl = new URL("https://detect.roboflow.com/weed-detection-in-a-field/1");
      apiUrl.searchParams.append("api_key", "ODFVNgXRpj6eKSgnwEad");
      apiUrl.searchParams.append("confidence", "50");
      apiUrl.searchParams.append("overlap", "30");

      const res = await fetch(apiUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: base64Image,
      });

      const result = await res.json();
      setApiResults(result);

      if (result?.predictions?.length > 0) {
        const annotatedUrl = await createAnnotatedImage(imageData, result.predictions);
        setAnnotatedImageUrl(annotatedUrl);
      }

      toast({ title: "Run Complete", description: `${result.predictions.length} detections` });
    } catch (err) {
      toast({ title: "Error", description: "Detection failed", variant: "destructive" });
    } finally {
      setIsRunning(false);
    }
  };

  const createAnnotatedImage = (imageData, detections) =>
    new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        detections.forEach((d) => {
          const { x, y, width, height, confidence, class: className } = d;
          const left = x - width / 2;
          const top = y - height / 2;
          ctx.strokeStyle = "#00ff00";
          ctx.lineWidth = 2;
          ctx.strokeRect(left, top, width, height);
          const label = `${className} ${(confidence * 100).toFixed(1)}%`;
          ctx.font = "14px Arial";
          const textWidth = ctx.measureText(label).width;
          ctx.fillStyle = "#00ff00";
          ctx.fillRect(left, top - 20, textWidth + 10, 20);
          ctx.fillStyle = "#000000";
          ctx.fillText(label, left + 5, top - 5);
        });
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = imageData.url;
    });
  const startCamera = async (facingMode = "environment") => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === "videoinput");

    let targetDeviceId;

    if (facingMode === "environment") {
      // Try to find a rear-facing camera by label (works on most phones)
      const backCamera = videoDevices.find(device =>
        device.label.toLowerCase().includes("back") ||
        device.label.toLowerCase().includes("rear")
      );
      targetDeviceId = backCamera?.deviceId || videoDevices[0]?.deviceId;
    } else {
      // Use first available camera for front (or fallback)
      targetDeviceId = videoDevices[0]?.deviceId;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: targetDeviceId },
      },
      audio: false,
    });

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play();
    }
  } catch (err) {
    toast({
      title: "Camera Error",
      description: `Failed to access ${facingMode} camera.`,
      variant: "destructive",
    });
    console.error(err);
  }
};


  const stopCamera = () => {
    const stream = videoRef.current?.srcObject;
    if (stream && stream.getTracks) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setIsCameraOpen(false);
    setIsLive(false);
  };

  const startLiveDetection = async () => {
  if (isLive) return; // prevent multiple intervals
  resetAll();
  setIsLive(true);
  await startCamera();

  const checkVideoReady = () => {
    const video = videoRef.current;
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      const interval = setInterval(runLiveDetection, 2000);
      setLiveDetectionInterval(interval);
    } else {
      // Retry in 100ms until video is ready
      setTimeout(checkVideoReady, 100);
    }
  };

  checkVideoReady();
};


  const stopLiveDetection = () => {
    clearInterval(liveDetectionInterval);
    stopCamera();
    const canvas = liveCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const runLiveDetection = async () => {
    const video = videoRef.current;
  const canvas = liveCanvasRef.current;
    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) return;

    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const base64 = canvas.toDataURL("image/jpeg").split(",")[1];

    try {
      const apiUrl = new URL("https://detect.roboflow.com/weed-detection-in-a-field/1");
      apiUrl.searchParams.append("api_key", "ODFVNgXRpj6eKSgnwEad");
      apiUrl.searchParams.append("confidence", "50");
      apiUrl.searchParams.append("overlap", "30");

      const res = await fetch(apiUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: base64,
      });

      const result = await res.json();

      result.predictions.forEach(({ x, y, width, height, class: className, confidence }) => {
        const left = x - width / 2;
        const top = y - height / 2;
        ctx.strokeStyle = "#00ff00";
        ctx.lineWidth = 2;
        ctx.strokeRect(left, top, width, height);

        const label = `${className} ${(confidence * 100).toFixed(1)}%`;
        ctx.font = "14px Arial";
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = "#00ff00";
        ctx.fillRect(left, top - 20, textWidth + 10, 20);
        ctx.fillStyle = "#000";
        ctx.fillText(label, left + 5, top - 5);
      });
    } catch (err) {
      console.error("Live detection error:", err);
    }
  };

const toggleCamera = () => {
  const newFacing = cameraFacing === "environment" ? "user" : "environment";
  setCameraFacing(newFacing);

  // Stop old stream
  const oldStream = videoRef.current?.srcObject;
  if (oldStream && oldStream.getTracks) {
    oldStream.getTracks().forEach(track => track.stop());
  }

  // Start new stream with updated facing mode
  startCamera(newFacing);
};



const capturePhoto = () => {
  const video = videoRef.current;
  if (!video) return;

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);

  canvas.toBlob((blob) => {
    if (blob) {
      const file = new File([blob], "captured.jpg", { type: "image/jpeg" });
      handleFile(file);
    }
  }, "image/jpeg", 0.95);

  stopCamera();
};
const handleCaptureAndDetect = () => {
    const canvas = liveCanvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "captured-from-live.jpg", { type: "image/jpeg" });
        handleFile(file);
      }
    }, "image/jpeg", 0.95);
    toast({ title: "Captured", description: "Image from live feed saved for detection." });
  };
const toggleFullscreen = (element) => {
  if (!document.fullscreenElement) {
    element.requestFullscreen().catch((err) => {
      console.error("Error attempting to enable fullscreen mode:", err);
    });
  } else {
    document.exitFullscreen();
  }
};

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-slate-800 mb-4">Weed Detection Tool</h1>
        <p className="text-lg text-slate-600">By Shreyansh Agarwal 8-B</p>
      </div>

      <Card className="mb-8">
        <CardContent className="p-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-slate-800 mb-6">Upload Your Image</h2>

            <div className="flex justify-center gap-4 flex-wrap mb-4">
              <Button onClick={() => fileInputRef.current?.click()} className="bg-blue-500 text-white">
                <Upload className="w-4 h-4 mr-2" />
                Choose File
              </Button>
              <Button onClick={handleRun} disabled={isRunning} className="bg-green-600 text-white">
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Detect Weeds
                  </>
                )}
              </Button>
<Button
  onClick={() => {
    stopLiveDetection(); // 🔴 stop live if running
    resetAll();
    setIsLive(false);
    setIsCameraOpen(true);
    startCamera();
  }}
  className="bg-purple-600 text-white"
>
  <Plus className="w-4 h-4 mr-2" />
  Capture with Camera
</Button>
<Button
  onClick={() => {
    stopCamera(); // 🔴 stop camera mode
    resetAll();
    setIsCameraOpen(false);
    startLiveDetection();
  }}
  className="bg-orange-500 text-white"
>
  🎥 Start Live Detection
</Button>
              {isLive && (
                <Button onClick={stopLiveDetection} className="bg-red-600 text-white">
                  🛑 Stop Live Detection
                </Button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.webp"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="hidden"
            />
            <canvas ref={canvasRef} className="hidden" />

            {isCameraOpen && (
  <div className="mt-6 relative" id="camera-container">
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="rounded-lg shadow-md w-full max-w-md mx-auto"
    />
    <div className="flex justify-center gap-4 mt-4 flex-wrap">
      <Button onClick={capturePhoto} className="bg-green-600 hover:bg-green-700 text-white">
        📸 Take Photo
      </Button>
      <Button onClick={stopCamera} className="bg-red-500 hover:bg-red-600 text-white">
        ❌ Cancel
      </Button>
      <Button onClick={toggleCamera} className="bg-blue-500 hover:bg-blue-600 text-white">
        🔄 Switch Camera
      </Button>
    </div>
  </div>
)}


{isLive && (
  <div
    className="mt-6 w-full max-w-md mx-auto rounded-lg overflow-hidden border border-gray-300"
    id="live-container"
  >
    {/* Video and canvas layered */}
    <div className="relative w-full bg-black rounded-t-lg">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-auto object-contain rounded-t-lg"
      />
      <canvas
        ref={liveCanvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      />
    </div>

    {/* White background for buttons */}
{/* White background for buttons */}
<div className="flex justify-center gap-4 p-4 flex-wrap bg-white rounded-b-lg">
  <Button onClick={handleCaptureAndDetect} className="bg-green-700 text-white">
    <Camera className="w-4 h-4 mr-2" /> Capture Detection Image
  </Button>
  <Button
    onClick={() => toggleFullscreen(document.getElementById("live-container"))}
    className="bg-gray-600 hover:bg-gray-700 text-white"
  >
    🖥️ Fullscreen
  </Button>
  <Button onClick={toggleCamera} className="bg-blue-600 hover:bg-blue-700 text-white">
    🔄 Switch Camera
  </Button>
</div>

  </div>
)}




            {error && (
              <Alert className="mt-4 border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-600 font-medium">{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {imageData && (
        <Card>
          <CardContent className="p-8">
            <h2 className="text-2xl font-semibold mb-4 text-center text-slate-800">Your Image</h2>
            <img src={imageData.url} alt="Uploaded" className="w-full rounded-xl shadow-md max-h-96 object-contain" />
          </CardContent>
        </Card>
      )}

      {annotatedImageUrl && (
        <Card className="mt-8">
          <CardContent className="p-8">
            <h2 className="text-2xl font-semibold mb-4 text-center text-slate-800">Annotated Image</h2>
            <img src={annotatedImageUrl} alt="Annotated" className="w-full rounded-xl shadow-md max-h-96 object-contain" />
          </CardContent>
        </Card>
      )}

      {apiResults && (
        <Card className="mt-8">
          <CardContent className="p-8">
            <h2 className="text-2xl font-semibold mb-4 text-center text-slate-800">Detection Results</h2>
            <pre className="bg-slate-50 p-4 rounded text-sm overflow-x-auto">{JSON.stringify(apiResults, null, 2)}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
