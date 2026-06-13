import { useEffect, useState, useRef, useCallback } from "react";
import Cropper from "react-easy-crop";
import { useEscapeKey } from "@hooks/useEscapeKey";

import {
  X,
  SendHorizonal,
  Trash2,
  Crop,
  Pencil,
  Eraser,
  Check,
  Image as ImageIcon,
  FileText,
  Video,
  Music,
} from "lucide-react";

function MediaPreviewModal({ files = [], onClose, onSend, uploading }) {
  const [caption, setCaption] = useState("");

  const [previewFiles, setPreviewFiles] = useState([]);

  const [editingIndex, setEditingIndex] = useState(null);

  const handleSend = useCallback(() => {
    const finalFiles = previewFiles.map((item) => item.file);
    onSend(finalFiles, caption);
  }, [previewFiles, onSend, caption]);

  // Centralized ESC handling: priority 20 when editing (resets editing), priority 15 when not editing (closes modal)
  useEscapeKey(() => {
    setEditingIndex(null);
  }, editingIndex !== null, 20);

  useEscapeKey(onClose, editingIndex === null, 15);

  /* =========================
     MODES
  ========================== */

  const [mode, setMode] = useState("crop");

  /* =========================
     CROP
  ========================== */

  const [crop, setCrop] = useState({
    x: 0,
    y: 0,
  });

  const [zoom, setZoom] = useState(1);

  const [rotation, setRotation] = useState(0);

  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  /* =========================
     DRAW
  ========================== */

  const canvasRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);

  const [brushColor, setBrushColor] = useState("#ffffff");

  const [brushSize, setBrushSize] = useState(5);

  const [isErasing, setIsErasing] = useState(false);


  /* =========================
     PREVIEW FILES
  ========================== */

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter" && editingIndex === null) {
        e.preventDefault();
        handleSend();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editingIndex, handleSend]);

  useEffect(() => {
    if (!files.length) return;

    const previews = files.map((file) => ({
      file,

      previewUrl: URL.createObjectURL(file),

      type: file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
          ? "video"
          : file.type.startsWith("audio/")
            ? "audio"
            : "file",
    }));

    const handle = requestAnimationFrame(() => {
      setPreviewFiles(previews);
    });

    return () => {
      cancelAnimationFrame(handle);
      previews.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [files]);

  /* =========================
     REMOVE FILE
  ========================== */

  const removeFile = (index) => {
    setPreviewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  /* =========================
     FILE SIZE
  ========================== */

  const formatFileSize = (bytes) => {
    const kb = bytes / 1024;

    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }

    return `${(kb / 1024).toFixed(1)} MB`;
  };

  /* =========================
     CROP COMPLETE
  ========================== */

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  /* =========================
     DRAW
  ========================== */

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;

    const rect = canvas.getBoundingClientRect();

    return {
      x: e.clientX - rect.left,

      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e) => {
    if (mode !== "draw") return;

    setIsDrawing(true);

    const canvas = canvasRef.current;

    const ctx = canvas.getContext("2d");

    const { x, y } = getCoordinates(e);

    ctx.beginPath();

    ctx.moveTo(x, y);

    ctx.lineCap = "round";

    ctx.lineJoin = "round";

    ctx.lineWidth = brushSize;

    if (isErasing) {
      ctx.globalCompositeOperation = "destination-out";
    } else {
      ctx.globalCompositeOperation = "source-over";

      ctx.strokeStyle = brushColor;
    }
  };

  const draw = (e) => {
    if (!isDrawing || mode !== "draw") return;

    const canvas = canvasRef.current;

    const ctx = canvas.getContext("2d");

    const { x, y } = getCoordinates(e);

    ctx.lineTo(x, y);

    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;

    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  /* =========================
     IMAGE HELPERS
  ========================== */

  const createImage = (url) =>
    new Promise((resolve, reject) => {
      const image = new Image();

      image.addEventListener("load", () => resolve(image));

      image.addEventListener("error", (error) => reject(error));

      image.setAttribute("crossOrigin", "anonymous");

      image.src = url;
    });

  const getRadianAngle = (degreeValue) => {
    return (degreeValue * Math.PI) / 180;
  };

  /* =========================
     SAVE IMAGE
  ========================== */

  const getEditedImage = async (imageSrc, pixelCrop, rotation = 0) => {
    const image = await createImage(imageSrc);

    const canvas = document.createElement("canvas");

    const ctx = canvas.getContext("2d");

    const rotRad = getRadianAngle(rotation);

    const maxSize = Math.max(image.width, image.height);

    const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

    canvas.width = safeArea;

    canvas.height = safeArea;

    ctx.translate(safeArea / 2, safeArea / 2);

    ctx.rotate(rotRad);

    ctx.translate(-safeArea / 2, -safeArea / 2);

    ctx.drawImage(
      image,
      safeArea / 2 - image.width / 2,
      safeArea / 2 - image.height / 2,
    );

    const data = ctx.getImageData(0, 0, safeArea, safeArea);

    canvas.width = pixelCrop.width;

    canvas.height = pixelCrop.height;

    ctx.putImageData(
      data,
      Math.round(-safeArea / 2 + image.width / 2 - pixelCrop.x),
      Math.round(-safeArea / 2 + image.height / 2 - pixelCrop.y),
    );

    /* DRAW LAYER */

    const drawCanvas = canvasRef.current;

    if (drawCanvas) {
      ctx.drawImage(drawCanvas, 0, 0, canvas.width, canvas.height);
    }

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(blob);
        },
        "image/jpeg",
        1,
      );
    });
  };

  const handleSaveEdit = async () => {
    try {
      const current = previewFiles[editingIndex];

      const editedBlob = await getEditedImage(
        current.previewUrl,
        croppedAreaPixels,
        rotation,
      );

      const editedFile = new File([editedBlob], current.file.name, {
        type: "image/jpeg",
      });

      const updated = [...previewFiles];

      updated[editingIndex] = {
        ...updated[editingIndex],

        file: editedFile,

        previewUrl: URL.createObjectURL(editedFile),
      };

      setPreviewFiles(updated);

      setEditingIndex(null);

      clearCanvas();

      setZoom(1);

      setRotation(0);

      setCrop({
        x: 0,
        y: 0,
      });

      setMode("crop");
    } catch (err) {
      console.log(err);
    }
  };

  if (!previewFiles.length) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4">
      {/* =========================================
    EDIT SCREEN
========================================= */}

      {editingIndex !== null && (
        <div className="fixed inset-0 z-[10000] bg-black flex flex-col">
          {/* =========================================
        TOP NAVBAR
    ========================================= */}

          <div className="h-[62px] px-4 bg-black/70 backdrop-blur-xl border-b border-white/10 flex items-center justify-between">
            {/* LEFT */}

            <button
              onClick={() => setEditingIndex(null)}
              className="
          w-10
          h-10

          rounded-full

          flex
          items-center
          justify-center

          bg-white/10
          hover:bg-white/20

          transition
        "
            >
              <X size={20} className="text-white" />
            </button>

            {/* CENTER */}

            <div className="flex items-center gap-3">
              {/* CROP */}

              <button
                onClick={() => setMode("crop")}
                className={`
            h-10

            px-4

            rounded-full

            flex
            items-center
            gap-2

            text-sm
            font-medium

            transition-all

            ${
              mode === "crop"
                ? "bg-white text-black"
                : "bg-white/10 text-white hover:bg-white/20"
            }
          `}
              >
                <Crop size={17} />
                Crop
              </button>

              {/* DRAW */}

              <button
                onClick={() => {
                  setMode("draw");

                  setIsErasing(false);
                }}
                className={`
            h-10

            px-4

            rounded-full

            flex
            items-center
            gap-2

            text-sm
            font-medium

            transition-all

            ${
              mode === "draw" && !isErasing
                ? "bg-brand text-white"
                : "bg-white/10 text-white hover:bg-white/20"
            }
          `}
              >
                <Pencil size={17} />
                Draw
              </button>
            </div>

            {/* RIGHT */}

            <button
              onClick={handleSaveEdit}
              className="
          w-10
          h-10

          rounded-full

          flex
          items-center
          justify-center

          bg-brand

          hover:scale-105

          transition
        "
            >
              <Check size={20} className="text-white" />
            </button>
          </div>

          {/* =========================================
        IMAGE AREA
    ========================================= */}

          <div className="flex-1 relative overflow-hidden bg-black">
            {/* CROP */}

            <Cropper
              image={previewFiles[editingIndex].previewUrl}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={4 / 5}
              objectFit="contain"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              style={{
                containerStyle: {
                  background: "#000",
                },
              }}
            />

            {/* DRAW LAYER */}

            <canvas
              ref={canvasRef}
              width={window.innerWidth}
              height={window.innerHeight}
              className={`absolute inset-0 z-20 ${
                mode === "draw" ? "pointer-events-auto" : "pointer-events-none"
              }`}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />
          </div>

          {/* =========================================
        DRAW TOOLBAR
    ========================================= */}

          {mode === "draw" && (
            <div
              className="
          bg-black/80
          backdrop-blur-2xl

          border-t
          border-white/10

          px-5
          py-4

          space-y-4
        "
            >
              {/* COLORS */}

              <div className="flex items-center justify-center gap-4 flex-wrap">
                {[
                  "#ffffff",
                  "#ff3b30",
                  "#34c759",
                  "#0a84ff",
                  "#ffd60a",
                  "#bf5af2",
                  "#ff9500",
                  "#000000",
                ].map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      setBrushColor(color);

                      setIsErasing(false);
                    }}
                    className={`
                relative

                w-10
                h-10

                rounded-full

                transition-all
                duration-200

                ${
                  brushColor === color && !isErasing
                    ? "scale-125 ring-4 ring-white/40"
                    : "hover:scale-110"
                }
              `}
                    style={{
                      background: color,
                    }}
                  />
                ))}

                {/* ERASER */}

                <button
                  onClick={() => {
                    setIsErasing(true);

                    setMode("draw");
                  }}
                  className={`
              w-10
              h-10

              rounded-full

              flex
              items-center
              justify-center

              transition-all

              ${
                isErasing
                  ? "bg-red-500 scale-125"
                  : "bg-white/10 hover:bg-white/20"
              }
            `}
                >
                  <Eraser size={18} className="text-white" />
                </button>
              </div>

              {/* BRUSH */}

              <div className="flex items-center gap-4">
                {/* PREVIEW */}

                <div
                  className="
              rounded-full
              bg-white
              shrink-0
            "
                  style={{
                    width: brushSize,
                    height: brushSize,
                  }}
                />

                {/* RANGE */}

                <input
                  type="range"
                  min={2}
                  max={40}
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="
              flex-1

              accent-brand

              h-2

              cursor-pointer
            "
                />

                {/* SIZE */}

                <div
                  className="
              text-white/80
              text-sm

              w-[40px]
              text-right
            "
                >
                  {brushSize}
                </div>
              </div>
            </div>
          )}

          {/* =========================================
        CROP TOOLBAR
    ========================================= */}

          {mode === "crop" && (
            <div
              className="
          bg-black/80
          backdrop-blur-2xl

          border-t
          border-white/10

          px-5
          py-4

          space-y-5
        "
            >
              {/* ZOOM */}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm">Zoom</span>

                  <span className="text-white/60 text-sm">
                    {zoom.toFixed(1)}x
                  </span>
                </div>

                <input
                  type="range"
                  min={1}
                  max={5}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="
              w-full

              accent-brand

              cursor-pointer
            "
                />
              </div>

              {/* ROTATE */}

              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => setRotation(rotation - 90)}
                  className="
              flex-1

              h-11

              rounded-xl

              bg-white/10
              hover:bg-white/20

              text-white

              transition
            "
                >
                  Rotate Left
                </button>

                <button
                  onClick={() => setRotation(rotation + 90)}
                  className="
              flex-1

              h-11

              rounded-xl

              bg-white/10
              hover:bg-white/20

              text-white

              transition
            "
                >
                  Rotate Right
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================
          MAIN PREVIEW
      ===================================== */}

      <div className="bg-app-modal border border-app-border rounded-2xl w-full max-w-6xl h-[94vh] flex flex-col overflow-hidden text-app-text-primary animate-fade-in">
        {/* HEADER */}

        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border bg-app-header">
          <div>
            <h2 className="text-app-text-primary text-lg font-semibold">Media Preview</h2>

            <p className="text-sm text-app-text-secondary mt-1">
              {previewFiles.length} selected
            </p>
          </div>

          <button onClick={onClose} className="text-app-text-secondary hover:text-app-text-primary">
            <X size={26} />
          </button>
        </div>

        {/* CONTENT */}

        <div className="flex-1 overflow-y-auto p-4 bg-app-drawer">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {previewFiles.map((item, index) => (
              <div
                key={index}
                className="relative bg-app-header rounded-2xl overflow-hidden border border-app-border"
              >
                {/* ACTIONS */}

                <div className="absolute top-3 right-3 z-30 flex gap-2">
                  {/* EDIT */}

                  {item.type === "image" && (
                    <button
                      onClick={() => {
                        setEditingIndex(index);

                        setMode("draw");

                        setIsErasing(false);
                      }}
                      className="bg-black/70 hover:bg-brand p-2 rounded-full text-white transition"
                    >
                      <Pencil size={16} />
                    </button>
                  )}

                  {/* CROP */}

                  {item.type === "image" && (
                    <button
                      onClick={() => {
                        setEditingIndex(index);

                        setMode("crop");
                      }}
                      className="bg-black/70 hover:bg-brand p-2 rounded-full text-white transition"
                    >
                      <Crop size={16} />
                    </button>
                  )}

                  {/* DELETE */}

                  <button
                    onClick={() => removeFile(index)}
                    className="bg-black/70 hover:bg-red-500 p-2 rounded-full text-white transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* IMAGE */}

                {item.type === "image" && (
                  <img
                    src={item.previewUrl}
                    alt="preview"
                    className="w-full h-[340px] object-contain bg-black"
                  />
                )}

                {/* VIDEO */}

                {item.type === "video" && (
                  <video controls className="w-full h-[340px] bg-black">
                    <source src={item.previewUrl} />
                  </video>
                )}

                {/* AUDIO */}

                {item.type === "audio" && (
                  <div className="h-[250px] flex flex-col items-center justify-center p-6">
                    <Music size={54} className="text-app-text-primary mb-4" />

                    <p className="text-app-text-primary text-sm mb-4">{item.file.name}</p>

                    <audio controls className="w-full">
                      <source src={item.previewUrl} />
                    </audio>
                  </div>
                )}

                {/* FILE */}

                {item.type === "file" && (
                  <div className="h-[250px] flex flex-col items-center justify-center p-6">
                    <FileText size={54} className="text-app-text-primary mb-4" />

                    <p className="text-app-text-primary text-center break-all">
                      {item.file.name}
                    </p>

                    <p className="text-app-text-secondary text-sm mt-2">
                      {formatFileSize(item.file.size)}
                    </p>
                  </div>
                )}

                {/* BADGE */}

                <div className="absolute bottom-3 left-3 bg-black/70 px-2 py-1 rounded-full text-xs text-white flex items-center gap-1">
                  {item.type === "image" && <ImageIcon size={12} />}

                  {item.type === "video" && <Video size={12} />}

                  {item.type === "audio" && <Music size={12} />}

                  {item.type === "file" && <FileText size={12} />}

                  <span>{item.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FOOTER */}

        <div className="border-t border-app-border p-4 flex items-center gap-3 bg-app-header">
          <input
            type="text"
            placeholder="Add a caption..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="flex-1 bg-app-drawer border border-app-border text-app-text-primary rounded-xl px-4 py-3 outline-none placeholder-app-text-secondary"
          />

          <button
            disabled={uploading}
            onClick={handleSend}
            className="bg-brand hover:opacity-90 p-4 rounded-full transition text-white"
          >
            <SendHorizonal size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default MediaPreviewModal;
