import { useState, useEffect } from "react";
import logo from "@assets/vite.svg";
import toast from "react-hot-toast";

function TitleBar() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handleMinimize = () => {
    toast.success("Minimized application window (simulate)");
  };

  const handleMaximize = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClose = () => {
    if (confirm("Are you sure you want to close Vertex Connect?")) {
      // Browsers restrict close() to scripts that opened the window.
      // We log simulated message.
      toast.error("Simulated closing window. Browser restrictions prevent programmatic closing.");
    }
  };

  return (
    <div className="h-8 bg-app-sidebar-rail border-b border-app-border/30 flex items-center justify-between select-none shrink-0 z-50">
      {/* Left side: Logo & Title */}
      <div className="flex items-center">
        <img src={logo} alt="Logo" className="w-4 h-4 ml-3 select-none" />
        <span className="text-[12px] font-medium text-app-text-primary/80 ml-2 tracking-wide font-sans">
          Vertex Connect
        </span>
      </div>

      {/* Right side: Control Buttons */}
      <div className="flex items-center h-full">
        {/* Minimize */}
        <button
          onClick={handleMinimize}
          className="h-8 w-11 flex items-center justify-center text-app-text-secondary hover:bg-app-hover hover:text-app-text-primary transition-colors cursor-pointer"
          title="Minimize"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 10.2 1" fill="currentColor">
            <rect x="0" y="0" width="10.2" height="1" />
          </svg>
        </button>

        {/* Maximize / Restore */}
        <button
          onClick={handleMaximize}
          className="h-8 w-11 flex items-center justify-center text-app-text-secondary hover:bg-app-hover hover:text-app-text-primary transition-colors cursor-pointer"
          title={isFullscreen ? "Restore Down" : "Maximize"}
        >
          {isFullscreen ? (
            <svg className="w-3 h-3" viewBox="0 0 10.2 10.2" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M2.1,2.1 L2.1,0.5 L9.7,0.5 L9.7,8.1 L8.1,8.1" />
              <path d="M0.5,2.1 L8.1,2.1 L8.1,9.7 L0.5,9.7 Z" />
            </svg>
          ) : (
            <svg className="w-3 h-3" viewBox="0 0 10.2 10.2" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="0.5" y="0.5" width="9.2" height="9.2" />
            </svg>
          )}
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          className="h-8 w-11 flex items-center justify-center text-app-text-secondary hover:bg-[#e81123] hover:text-white transition-colors cursor-pointer"
          title="Close"
        >
          <svg className="w-3 h-3" viewBox="0 0 10.2 10.2" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M0.5,0.5 L9.7,9.7" />
            <path d="M9.7,0.5 L0.5,9.7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default TitleBar;
