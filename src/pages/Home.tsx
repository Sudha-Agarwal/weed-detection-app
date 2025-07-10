import { useState, useRef } from "react";
import { 
  Upload, 
  CloudUpload, 
  CheckCircle, 
  AlertTriangle, 
  Download, 
  Plus,
  Loader2,
  Play
} from "lucide-react";

// Basic UI components (you'll need to install these or create your own)
const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-lg border shadow-sm ${className}`}>
    {children}
  </div>
);

const CardContent = ({ children, className = "" }) => (
  <div className={`p-6 ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, disabled = false, className = "" }) => (
  <button
    onClick={onClick}
    disabled={disabled}
     className={`flex items-center justify-center px-4 py-2 rounded-md font-medium transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'} ${className}`}
  >
    {children}
  </button>
);

const Alert = ({ children, className = "" }) => (
  <div className={`border rounded-md p-4 ${className}`}>
    {children}
  </div>
);

const AlertDescription = ({ children, className = "" }) => (
  <div className={`text-sm ${className}`}>
    {children}
  </div>
);

// Toast function (simplified)
const toast = ({ title, description, variant = "default" }) => {
  const toastEl = document.createElement('div');
  toastEl.className = `fixed top-4 right-4 bg-white border rounded-md p-4 shadow-lg z-50 ${variant === 'destructive' ? 'border-red-500 bg-red-50' : 'border-green-500 bg-green-50'}`;
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
  const [dragActive, setDragActive] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [apiResults, setApiResults] = useState(null);
  const [annotatedImageUrl, setAnnotatedImageUrl] = useState(null);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file) => {
    if (!allowedTypes.includes(file.type)) {
      return 'Please select a valid image file (JPG, PNG, GIF, or WebP)';
    }
    if (file.size > maxSize) {
      return 'File size should not exceed 10MB';
    }
    return null;
  };

  const processImage = async (file) => {
    setIsLoading(true);
    setError(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        setImageData({
          file,
          url: result,
          name: file.name,
          size: formatFileSize(file.size),
          type: file.type
        });
        setIsLoading(false);
        toast({
          title: "Success!",
          description: "Image uploaded successfully",
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setIsLoading(false);
      setError('Failed to process image. Please try again.');
    }
  };

  const handleFile = (file) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    processImage(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleRun = async () => {
    if (!imageData) {
      toast({
        title: "No Image",
        description: "Please upload an image first before running",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);
    
    try {
      const base64Image = imageData.url.split(',')[1];
      
      const apiUrl = new URL("https://detect.roboflow.com/weed-detection-in-a-field/1");
      apiUrl.searchParams.append("api_key", "ODFVNgXRpj6eKSgnwEad");
      apiUrl.searchParams.append("confidence", "50");
      apiUrl.searchParams.append("overlap", "30");
      
      const response = await fetch(apiUrl.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: base64Image,
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }

      const result = await response.json();
      setApiResults(result);
      
      if (result.predictions.length > 0) {
        const annotatedUrl = await createAnnotatedImage(imageData, result.predictions);
        setAnnotatedImageUrl(annotatedUrl);
      }
      
      toast({
        title: "Run Complete!",
        description: `Found ${result.predictions.length} weed detections`,
      });
      
    } catch (error) {
      console.error("Error calling Roboflow API:", error);
      toast({
        title: "API Error",
        description: "Failed to process image",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const createAnnotatedImage = async (imageData, detections) => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        detections.forEach((detection) => {
          const { x, y, width, height, confidence, class: className } = detection;
          
          const left = x - width / 2;
          const top = y - height / 2;

          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 3;
          ctx.strokeRect(left, top, width, height);

          const label = `${className} ${(confidence * 100).toFixed(1)}%`;
          ctx.font = '16px Arial';
          const textMetrics = ctx.measureText(label);
          const textWidth = textMetrics.width;
          const textHeight = 20;

          ctx.fillStyle = '#00ff00';
          ctx.fillRect(left, top - textHeight - 5, textWidth + 10, textHeight + 5);

          ctx.fillStyle = '#000000';
          ctx.fillText(label, left + 5, top - 8);
        });

        resolve(canvas.toDataURL('image/png'));
      };
      
      img.src = imageData.url;
    });
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
            
            <div
              className={`border-2 border-dashed rounded-xl p-12 mb-6 transition-all duration-300 cursor-pointer ${
                dragActive 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-slate-300 hover:border-blue-500 hover:bg-slate-50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleUploadClick}
            >
              {isLoading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-4" />
                  <p className="text-lg text-slate-600">Processing your image...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <CloudUpload className="w-16 h-16 text-slate-400 mb-4" />
                  <p className="text-xl text-slate-600 mb-4">Click to upload or drag and drop</p>
                  <p className="text-sm text-slate-500 mb-6">Supports JPG, PNG, GIF, WebP files</p>
                  <div className="flex gap-4 justify-center">
                    <Button className="bg-blue-500 hover:bg-blue-600 text-white">
                      <Upload className="w-4 h-4 mr-2" />
                      Choose File
                    </Button>
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRun();
                      }}
                      disabled={isRunning}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
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
                  </div>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.webp"
              onChange={handleFileSelect}
              className="hidden"
            />

            <canvas ref={canvasRef} className="hidden" />
            
            {error && (
              <Alert className="mb-6 border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-600 font-medium">
                  {error}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {imageData && (
        <Card>
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-slate-800">Your Image</h2>
              <p className="text-slate-600 mt-2">Preview of your uploaded image</p>
            </div>
            
            <div className="relative">
              <img 
                src={imageData.url} 
                alt="Uploaded image preview" 
                className="w-full h-auto max-h-96 object-contain rounded-xl shadow-md mx-auto"
              />
              
              <div className="mt-6 bg-slate-50 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-slate-500 mb-1">File Name</p>
                    <p className="font-medium text-slate-800 break-all text-xs md:text-sm" title={imageData.name}>
                      {imageData.name}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500 mb-1">File Size</p>
                    <p className="font-medium text-slate-800">{imageData.size}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500 mb-1">File Type</p>
                    <p className="font-medium text-slate-800">{imageData.type}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {annotatedImageUrl && (
        <Card className="mt-8">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-slate-800">Annotated Image</h2>
              <p className="text-slate-600 mt-2">Original image with detected weeds highlighted</p>
            </div>
            
            <div className="relative">
              <img 
                src={annotatedImageUrl} 
                alt="Annotated image with detection boxes" 
                className="w-full h-auto max-h-96 object-contain rounded-xl shadow-md mx-auto"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {apiResults && (
        <Card className="mt-8">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-slate-800">Detection Results</h2>
              <p className="text-slate-600 mt-2">Found {apiResults.predictions.length} weed detections</p>
            </div>
            
            <div className="bg-slate-50 rounded-lg p-4">
              <pre className="text-sm overflow-auto">
                {JSON.stringify(apiResults, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}