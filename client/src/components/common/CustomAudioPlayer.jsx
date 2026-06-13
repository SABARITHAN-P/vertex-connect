import { useState, useRef, useEffect, useMemo } from "react";
import { Play, Pause } from "lucide-react";
import api from "@services/api";

function CustomAudioPlayer({ src, isVoiceMessage = false, messageId, own, isPlayed = false, peaks = [] }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Load cached speed from localStorage (default: 1)
  const [playbackRate, setPlaybackRate] = useState(() => {
    const saved = localStorage.getItem("vertex_voice_playback_rate");
    return saved ? parseFloat(saved) : 1;
  });

  const [isLocallyPlayed, setIsLocallyPlayed] = useState(false);
  const hasPlayed = isPlayed || isLocallyPlayed;

  const audioRef = useRef(null);
  const waveformContainerRef = useRef(null);

  // Generate robust fallback peaks for legacy messages or failed peak states
  const finalPeaks = useMemo(() => {
    if (peaks && peaks.length > 0) return peaks;
    // Generate realistic wave simulation if no peaks are supplied
    // Pure function to avoid impure Math.random() during render
    return Array.from({ length: 38 }, (_, i) => {
      const base = Math.sin(i * 0.28) * 0.45 + 0.5;
      const pseudoNoise = Math.sin(i * 1.57) * 0.18;
      return Math.max(0.15, Math.min(1.0, base + pseudoNoise));
    });
  }, [peaks]);

  // Sync state on metadata load & audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      setDuration(audio.duration || 0);
      audio.playbackRate = playbackRate; // Apply persisted speed
    };

    const setAudioTime = () => {
      if (!isDragging) {
        setCurrentTime(audio.currentTime);
        setProgress((audio.currentTime / (audio.duration || 1)) * 100);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", setAudioData);
    audio.addEventListener("timeupdate", setAudioTime);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", setAudioData);
      audio.removeEventListener("timeupdate", setAudioTime);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [playbackRate, isDragging]);

  // Multi-audio exclusive lock: pause when another voice note starts playing
  useEffect(() => {
    const handleVoiceNotePlayed = (e) => {
      if (e.detail.messageId !== messageId) {
        audioRef.current?.pause();
        setIsPlaying(false);
      }
    };
    window.addEventListener("voice-note-played", handleVoiceNotePlayed);
    return () => {
      window.removeEventListener("voice-note-played", handleVoiceNotePlayed);
    };
  }, [messageId]);

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      // Dispatches exclusive playback lock event
      window.dispatchEvent(new CustomEvent("voice-note-played", { detail: { messageId } }));
      
      // Attempt play (handling possible modern browser autoplay gesture lock)
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        console.error("Autoplay interaction blocked:", err);
      }
      
      // Mark as read/played if received & unplayed
      if (!own && !hasPlayed && messageId) {
        setIsLocallyPlayed(true);
        try {
          await api.patch(`/message/read-voice/${messageId}`);
        } catch (error) {
          console.error("Failed to mark voice message as read", error);
        }
      }
    }
  };

  const togglePlaybackRate = () => {
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;

    setPlaybackRate(nextRate);
    localStorage.setItem("vertex_voice_playback_rate", nextRate.toString());
    
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  // Waveform scrubbing & click handling
  const handleScrub = (e) => {
    if (!waveformContainerRef.current || !duration) return;

    const rect = waveformContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const clickedPercentage = Math.max(0, Math.min(100, (clickX / width) * 100));

    if (audioRef.current) {
      audioRef.current.currentTime = (clickedPercentage / 100) * duration;
    }
    setCurrentTime((clickedPercentage / 100) * duration);
    setProgress(clickedPercentage);
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    handleScrub(e);
  };

  useEffect(() => {
    const handleMouseMoveGlobal = (e) => {
      if (!isDragging || !waveformContainerRef.current || !duration) return;
      const rect = waveformContainerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const clickedPercentage = Math.max(0, Math.min(100, (clickX / width) * 100));

      if (audioRef.current) {
        audioRef.current.currentTime = (clickedPercentage / 100) * duration;
      }
      setCurrentTime((clickedPercentage / 100) * duration);
      setProgress(clickedPercentage);
    };

    const handleMouseUpGlobal = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMoveGlobal);
      window.addEventListener("mouseup", handleMouseUpGlobal);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMoveGlobal);
      window.removeEventListener("mouseup", handleMouseUpGlobal);
    };
  }, [isDragging, duration]);

  const handleMouseMove = (e) => {
    if (!waveformContainerRef.current) return;
    const rect = waveformContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(100, (clickX / width) * 100));
    const index = Math.floor((percentage / 100) * finalPeaks.length);
    setHoveredIndex(index);
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  const formatTime = (time) => {
    if (typeof time !== "number" || isNaN(time) || !isFinite(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Calculate filled bars
  const playedCount = Math.floor((progress / 100) * finalPeaks.length);

  return (
    <div className={`flex items-center gap-3.5 w-full py-1.5 ${isVoiceMessage ? "min-w-[220px]" : "min-w-[260px]"}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      {/* PLAY/PAUSE TRIGGER */}
      <div className="relative shrink-0 select-none">
        <button 
          onClick={togglePlayPause}
          className={`w-11 h-11 flex items-center justify-center rounded-full transition-all duration-300 shadow-md hover:shadow-lg active:scale-95 cursor-pointer relative z-10 border border-white/10 ${
            hasPlayed
              ? "bg-brand text-white hover:brightness-110 hover:shadow-brand/20"
              : "bg-amber-500 text-white hover:bg-amber-600 hover:shadow-amber-500/20"
          }`}
          style={{
            boxShadow: isPlaying 
              ? `0 0 16px ${hasPlayed ? "var(--color-brand)" : "#f59e0b"}` 
              : undefined
          }}
          title={isPlaying ? "Pause" : "Play Voice Note"}
        >
          {isPlaying && (
            <span className={`absolute inset-0 rounded-full animate-ping pointer-events-none opacity-20 scale-105 ${
              hasPlayed ? "bg-brand" : "bg-amber-500"
            }`} />
          )}
          {isPlaying ? (
            <Pause size={18} className="text-white fill-white animate-fade-in relative z-10" />
          ) : (
            <Play size={18} className="text-white fill-white ml-0.5 animate-fade-in relative z-10" />
          )}
        </button>
        
        {/* NEW/UNREAD PULSING INDICATOR */}
        {!own && !hasPlayed && isVoiceMessage && (
          <div 
            className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-500 dark:bg-amber-400 rounded-full border-2 border-app-card shadow-sm flex items-center justify-center z-20"
            title="New voice note" 
          >
            <span className="absolute w-full h-full rounded-full bg-amber-500 dark:bg-amber-400 opacity-75 animate-ping pointer-events-none" />
          </div>
        )}
      </div>

      {/* WAVEFORM PRECISE SEEK DECK */}
      <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
        <div 
          ref={waveformContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="relative h-7 w-full cursor-pointer flex items-center gap-[2px] select-none group"
          title="Drag or click to seek"
        >
          {finalPeaks.map((peak, idx) => {
            const isPlayedBar = idx <= playedCount;
            const isHoveredBar = hoveredIndex !== null && idx <= hoveredIndex;
            
            let barColor;
            let barOpacity;
            
            if (isPlayedBar) {
              barColor = hasPlayed ? "var(--brand-color)" : "#f59e0b";
              barOpacity = "opacity-100";
            } else if (isHoveredBar) {
              barColor = hasPlayed ? "var(--brand-color)" : "#f59e0b";
              barOpacity = "opacity-70";
            } else {
              barColor = "currentColor";
              barOpacity = "opacity-30 group-hover:opacity-40";
            }

            // Fisheye zoom effect on hover, and gentle pulse on play
            let scaleY = 1;
            if (hoveredIndex !== null) {
              const distance = Math.abs(idx - hoveredIndex);
              if (distance === 0) scaleY = 1.35;
              else if (distance === 1) scaleY = 1.2;
              else if (distance === 2) scaleY = 1.08;
            } else if (isPlayedBar && isPlaying) {
              scaleY = 1.05;
            }

            return (
              <div 
                key={idx} 
                className={`w-[3px] rounded-full transition-all duration-200 ${barOpacity}`}
                style={{ 
                  height: `${Math.max(12, peak * 100)}%`,
                  backgroundColor: barColor,
                  transform: `scaleY(${scaleY})`,
                  transformOrigin: "center"
                }}
              />
            );
          })}

          {/* ACTIVE HOVER/DRAG HANDLE */}
          <div 
            className={`absolute h-3.5 w-3.5 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition-all duration-200 pointer-events-none flex items-center justify-center -translate-y-1/2 top-1/2 ${
              isDragging || hoveredIndex !== null ? "opacity-100 scale-110" : "opacity-0"
            }`}
            style={{ 
              left: `calc(${progress}% - 7px)`, 
              border: `2px solid ${hasPlayed ? "var(--brand-color)" : "#f59e0b"}`
            }}
          >
            <div 
              className="w-1.5 h-1.5 rounded-full" 
              style={{
                backgroundColor: hasPlayed ? "var(--brand-color)" : "#f59e0b"
              }}
            />
          </div>
        </div>

        {/* METADATA SUMMARY & SPEED PREFERENCE */}
        <div className={`flex justify-between items-center text-[10px] font-semibold tracking-wide ${own ? "text-current opacity-75" : "text-app-text-secondary"}`}>
          <span className="font-mono tabular-nums">{formatTime(currentTime)}</span>
          <div className="flex items-center gap-2">
            {isVoiceMessage && (
              <button 
                onClick={togglePlaybackRate}
                className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold transition-all duration-200 active:scale-95 shrink-0 border select-none ${
                  own 
                    ? "bg-current/10 hover:bg-current/20 text-current border-current/10" 
                    : "bg-app-hover hover:bg-app-active text-app-text-primary border-app-border"
                }`}
                title="Toggle playback speed"
              >
                {playbackRate}x
              </button>
            )}
            <span className="font-mono tabular-nums">{formatTime(duration || parseFloat(duration))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CustomAudioPlayer;
