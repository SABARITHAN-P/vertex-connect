import React, { useState, useEffect, useRef } from "react";
import { X, RotateCw, ZoomIn, ZoomOut, Sparkles, Sun, Contrast } from "lucide-react";
import { useEscapeKey } from "@hooks/useEscapeKey";

function ImageEditorModal({ isOpen, onClose, imageSrc, onSave }) {
  // Centralized ESC handling: priority 20 since it's a nested cropper modal
  useEscapeKey(onClose, isOpen, 20);

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [activeFilter, setActiveFilter] = useState("none");
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  
  const containerRef = useRef(null);
  const imageRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Reset controls
      setZoom(1);
      setRotation(0);
      setBrightness(100);
      setContrast(100);
      setActiveFilter("none");
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, imageSrc]);

  if (!isOpen || !imageSrc) return null;

  const filters = [
    { name: "Original", id: "none", class: "" },
    { name: "B&W", id: "grayscale", filterStr: "grayscale(100%)" },
    { name: "Sepia", id: "sepia", filterStr: "sepia(100%)" },
    { name: "Vintage", id: "vintage", filterStr: "sepia(50%) contrast(140%) brightness(90%) hue-rotate(-20deg)" },
    { name: "Warm", id: "warm", filterStr: "sepia(20%) saturate(140%)" },
    { name: "Cool", id: "cool", filterStr: "hue-rotate(30deg) saturate(110%)" },
    { name: "High Contrast", id: "high-contrast", filterStr: "contrast(160%) brightness(105%)" }
  ];

  const getFilterStyle = (filterId) => {
    const f = filters.find((x) => x.id === filterId);
    return f ? f.filterStr || "" : "";
  };

  // Drag handlers
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
    dragStart.current = { x: clientX - position.x, y: clientY - position.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
    setPosition({
      x: clientX - dragStart.current.x,
      y: clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const rotateImage = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleSave = () => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Standard production resolution
      canvas.width = 500;
      canvas.height = 500;
      const ctx = canvas.getContext("2d");

      if (!ctx) return;

      // Fill canvas background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 500, 500);

      // Save canvas state
      ctx.save();

      // Set origin to center
      ctx.translate(250, 250);

      // 1. Rotation
      ctx.rotate((rotation * Math.PI) / 180);

      // 2. Zoom & drag position translation (scaled by canvas factor)
      // Estimate relative dimension mapping
      const baseDim = Math.min(img.width, img.height);
      const scaleX = 500 / baseDim;
      
      // Compute display bounds
      const drawWidth = img.width * scaleX;
      const drawHeight = img.height * scaleX;

      // Apply zoom & translation offsets
      ctx.scale(zoom, zoom);
      ctx.translate(position.x * (500 / 300), position.y * (500 / 300));

      // Apply CSS Filters directly to canvas context if supported
      let canvasFilter = `brightness(${brightness}%) contrast(${contrast}%)`;
      const currentFilter = getFilterStyle(activeFilter);
      if (currentFilter) {
        canvasFilter += ` ${currentFilter}`;
      }
      ctx.filter = canvasFilter;

      // Draw centered image
      ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

      // Restore state
      ctx.restore();

      // Export as Blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            onSave(blob);
          }
        },
        "image/jpeg",
        0.9
      );
    };
  };

  const activeFilterStr = getFilterStyle(activeFilter);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-app-modal border border-app-border text-app-text-primary w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-app-border flex justify-between items-center bg-app-header/60">
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand">Edit Profile Photo</h2>
          <button onClick={onClose} className="p-1 rounded-full text-app-text-secondary hover:text-app-text-primary transition cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* WORKSPACE AREA */}
        <div className="flex-1 p-6 flex flex-col items-center justify-center bg-app-drawer overflow-y-auto">
          {/* CROPPER BOX CONTAINER */}
          <div
            ref={containerRef}
            className="w-[300px] h-[300px] relative overflow-hidden rounded-full border-2 border-brand/40 bg-app-modal cursor-grab active:cursor-grabbing shadow-inner flex items-center justify-center"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
          >
            {/* DRAGGABLE CROP IMAGE */}
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Crop target"
              className="max-w-none select-none pointer-events-none transition-transform duration-75"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                filter: `brightness(${brightness}%) contrast(${contrast}%) ${activeFilterStr}`,
                width: "100%",
                height: "100%",
                objectFit: "contain"
              }}
            />

            {/* Circular Preview Ring Highlight Overlay */}
            <div className="absolute inset-0 rounded-full border-[3px] border-brand pointer-events-none opacity-50 shadow-md" />
          </div>
          <span className="text-[10px] text-app-text-secondary mt-2 italic font-semibold">
            Drag to reposition inside the circle
          </span>

          {/* CONTROLS ZONE */}
          <div className="w-full mt-6 space-y-4">
            {/* ZOOM SLIDER */}
            <div className="flex items-center gap-4 bg-app-input/40 p-2.5 rounded-xl border border-app-border/30">
              <ZoomOut size={16} className="text-app-text-secondary" />
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 accent-brand h-1 bg-app-hover rounded-lg cursor-pointer"
              />
              <ZoomIn size={16} className="text-app-text-secondary" />
              <button
                onClick={rotateImage}
                className="p-1.5 bg-brand/20 text-brand border border-brand/30 rounded-lg hover:bg-brand/30 transition shrink-0 cursor-pointer"
                title="Rotate 90°"
              >
                <RotateCw size={16} />
              </button>
            </div>

            {/* ADJUSTMENTS ZONE */}
            <div className="grid grid-cols-2 gap-3">
              {/* Brightness */}
              <div className="flex flex-col gap-1 bg-app-input/40 p-2.5 rounded-xl border border-app-border/30 text-xs">
                <span className="text-app-text-secondary font-medium flex items-center gap-1.5">
                  <Sun size={12} className="text-brand" /> Brightness
                </span>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={brightness}
                  onChange={(e) => setBrightness(parseInt(e.target.value))}
                  className="accent-brand h-1 bg-app-hover rounded-lg mt-1 cursor-pointer"
                />
              </div>

              {/* Contrast */}
              <div className="flex flex-col gap-1 bg-app-input/40 p-2.5 rounded-xl border border-app-border/30 text-xs">
                <span className="text-app-text-secondary font-medium flex items-center gap-1.5">
                  <Contrast size={12} className="text-brand" /> Contrast
                </span>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={contrast}
                  onChange={(e) => setContrast(parseInt(e.target.value))}
                  className="accent-brand h-1 bg-app-hover rounded-lg mt-1 cursor-pointer"
                />
              </div>
            </div>

            {/* FILTERS PANEL */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-app-text-secondary uppercase font-bold tracking-wider block flex items-center gap-1">
                <Sparkles size={11} className="text-brand" /> Color Effects
              </span>
              <div className="flex items-center gap-2 overflow-x-auto py-1.5 scrollbar-thin">
                {filters.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 border transition-all cursor-pointer ${
                      activeFilter === f.id
                        ? "bg-brand text-white border-brand"
                        : "bg-app-hover text-app-text-secondary border-app-border hover:bg-app-hover/80"
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-5 py-4 border-t border-app-border flex justify-end gap-3 bg-app-header/60">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-app-text-secondary hover:text-app-text-primary transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="bg-brand hover:opacity-90 text-white px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition shadow-md cursor-pointer"
          >
            Save Photo
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImageEditorModal;
