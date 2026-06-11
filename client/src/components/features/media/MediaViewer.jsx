import { useState, useEffect, useRef, useCallback } from "react";
import { X, ZoomIn, ZoomOut, Download, ArrowLeft, ArrowRight, RefreshCw, User } from "lucide-react";
import { useEscapeKey } from "@hooks/useEscapeKey";

function MediaViewer({ isOpen, onClose, initialMedia, mediaList = [] }) {
  const [prevInitialMedia, setPrevInitialMedia] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const viewerRef = useRef(null);

  // Synchronize state during render when initialMedia changes
  if (initialMedia !== prevInitialMedia) {
    setPrevInitialMedia(initialMedia);
    const idx = mediaList.length > 0 ? mediaList.findIndex((item) => item.url === initialMedia?.url) : -1;
    setCurrentIndex(idx !== -1 ? idx : -1);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }

  // Centralized ESC key support
  useEscapeKey(onClose, isOpen, 100);

  const activeMedia = currentIndex !== -1 && mediaList[currentIndex] ? mediaList[currentIndex] : initialMedia;

  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleNext = useCallback(() => {
    if (mediaList.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % mediaList.length);
    resetZoom();
  }, [mediaList.length, resetZoom]);

  const handlePrev = useCallback(() => {
    if (mediaList.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + mediaList.length) % mediaList.length);
    resetZoom();
  }, [mediaList.length, resetZoom]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === "ArrowRight" && mediaList.length > 1) {
        handleNext();
      } else if (e.key === "ArrowLeft" && mediaList.length > 1) {
        handlePrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, mediaList, handleNext, handlePrev]);

  // Zoom controls
  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 4));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  // Dragging / Panning implementation
  const handleMouseDown = (e) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Double tap / double click zoom toggle
  const handleDoubleClicked = () => {
    if (scale > 1) {
      resetZoom();
    } else {
      setScale(2);
    }
  };

  // Download Media File
  const handleDownload = async () => {
    if (!activeMedia?.url) return;
    try {
      const response = await fetch(activeMedia.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = blobUrl;
      const extension = activeMedia.type === "video" ? "mp4" : "jpg";
      // Use original file name if available, otherwise generate one
      const fileName = activeMedia.fileName || `vertex_media_${Date.now()}.${extension}`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Failed to download media file directly:", error);
      // Direct opening tab fallback if CORS blocking direct blob fetch
      window.open(activeMedia.url, "_blank");
    }
  };

  if (!isOpen || !activeMedia) return null;

  return (
    <div
      ref={viewerRef}
      className="fixed inset-0 z-[99999] bg-black/95 flex flex-col justify-between select-none animate-fade-in"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* HEADERBAR */}
      <div className="h-[64px] bg-app-header/80 backdrop-blur-md flex items-center justify-between px-4 z-50 border-b border-app-border/40">
        {/* SENDER DETAILS */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand/20 flex items-center justify-center border border-brand/30">
            <User size={16} className="text-brand" />
          </div>
          <div>
            <span className="text-app-text-primary text-xs font-semibold block">
              {activeMedia.senderName || "Sent Media"}
            </span>
            <span className="text-app-text-secondary text-[10px] block mt-0.5">
              {activeMedia.time || "Recently"}
            </span>
          </div>
        </div>

        {/* INDEX COUNTER */}
        {mediaList.length > 1 && (
          <span className="text-xs text-app-text-primary bg-app-hover/60 px-3 py-1.5 rounded-full font-bold tracking-wide">
            {currentIndex + 1} / {mediaList.length}
          </span>
        )}

        {/* ACTIONS */}
        <div className="flex items-center gap-3">
          {activeMedia.type !== "video" && (
            <>
              <button
                onClick={handleZoomIn}
                className="p-2 text-app-text-secondary hover:text-app-text-primary bg-app-hover/40 rounded-full hover:bg-app-hover/80 transition cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn size={18} />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-2 text-app-text-secondary hover:text-app-text-primary bg-app-hover/40 rounded-full hover:bg-app-hover/80 transition cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut size={18} />
              </button>
              <button
                onClick={resetZoom}
                className="p-2 text-app-text-secondary hover:text-app-text-primary bg-app-hover/40 rounded-full hover:bg-app-hover/80 transition cursor-pointer"
                title="Reset Zoom"
              >
                <RefreshCw size={16} />
              </button>
            </>
          )}

          <button
            onClick={handleDownload}
            className="p-2 text-app-text-secondary hover:text-app-text-primary bg-app-hover/40 rounded-full hover:bg-app-hover/80 transition cursor-pointer"
            title="Download Media"
          >
            <Download size={18} />
          </button>

          <button
            onClick={onClose}
            className="p-2 text-red-400 hover:text-red-300 bg-red-500/10 rounded-full hover:bg-red-500/20 transition ml-2 cursor-pointer"
            title="Close Viewer (ESC)"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* CENTRAL DISPLAY PORTPORT */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {/* NAVIGATE PREV */}
        {mediaList.length > 1 && (
          <button
            onClick={handlePrev}
            className="absolute left-6 p-3 text-app-text-secondary hover:text-app-text-primary bg-app-hover/40 rounded-full hover:bg-app-hover/80 transition z-50 cursor-pointer"
          >
            <ArrowLeft size={22} />
          </button>
        )}

        {/* CONTENT RENDERER */}
        <div
          className={`flex items-center justify-center transition-transform duration-200 ${
            isDragging ? "cursor-grabbing" : scale > 1 ? "cursor-grab" : "cursor-default"
          }`}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          }}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClicked}
        >
          {activeMedia.type === "video" ? (
            <video
              src={activeMedia.url}
              controls
              autoPlay
              className="max-w-[90vw] max-h-[80vh] rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={activeMedia.url}
              alt="Sent Media"
              className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg shadow-2xl select-none pointer-events-none"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>

        {/* NAVIGATE NEXT */}
        {mediaList.length > 1 && (
          <button
            onClick={handleNext}
            className="absolute right-6 p-3 text-app-text-secondary hover:text-app-text-primary bg-app-hover/40 rounded-full hover:bg-app-hover/80 transition z-50 cursor-pointer"
          >
            <ArrowRight size={22} />
          </button>
        )}
      </div>

      {/* FOOTER CAPTIONS */}
      {activeMedia.caption && (
        <div className="h-[60px] bg-app-header/80 backdrop-blur-md flex items-center justify-center px-6 z-50 text-app-text-primary text-xs border-t border-app-border/40 font-medium">
          {activeMedia.caption}
        </div>
      )}
    </div>
  );
}

export default MediaViewer;
