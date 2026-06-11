import { useState, useRef, useEffect, useMemo } from "react";
import { Play, Pause } from "lucide-react";
import api from "@services/api";

function CustomAudioPlayer({ src, isVoiceMessage = false, messageId, own, isPlayed = false, peaks = [] }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  // Load cached speed from localStorage (default: 1)
  const [playbackRate, setPlaybackRate] = useState(() => {
    const saved = localStorage.getItem("vertex_voice_playback_rate");
    return saved ? parseFloat(saved) : 1;
  });

  const [hasPlayed, setHasPlayed] = useState(isPlayed);
  const audioRef = useRef(null);
  const waveformContainerRef = useRef(null);

  // Generate robust fallback peaks for legacy messages or failed peak states
  const finalPeaks = useMemo(() => {
    if (peaks && peaks.length > 0) return peaks;
    // Generate realistic wave simulation if no peaks are supplied
    return Array.from({ length: 40 }, (_, i) => {
      const base = Math.sin(i * 0.25) * 0.5 + 0.5;
      const noise = Math.random() * 0.2;
      return Math.max(0.12, Math.min(1.0, base + noise));
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
      setCurrentTime(audio.currentTime);
      setProgress((audio.currentTime / (audio.duration || 1)) * 100);
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
  }, [playbackRate]);

  // Persist external read state
  useEffect(() => {
    setHasPlayed(isPlayed);
  }, [isPlayed]);

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
        setHasPlayed(true);
        try {
          await api.patch(`/message/read-voice/${messageId}`);
        } catch (error) {
          console.error("Failed to mark voice message as read", error);
        }
      }
    }
  };

  const togglePlaybackRate = () => {
    let nextRate = 1;
    if (playbackRate === 1) nextRate = 1.5;
    else if (playbackRate === 1.5) nextRate = 2;
    else nextRate = 1;

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
    setProgress(clickedPercentage);
  };

  const formatTime = (time) => {
    if (typeof time !== "number" || isNaN(time) || !isFinite(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Modern dynamic glassmorphic coloration
  const isBlue = (own && hasPlayed) || (!own && hasPlayed);
  const activeColorClass = isBlue ? "bg-brand" : (own ? "bg-app-text-secondary" : "bg-brand/70");

  // Calculate filled bars
  const playedCount = Math.floor((progress / 100) * finalPeaks.length);

  return (
    <div className={`flex items-center gap-3 w-full py-1 ${isVoiceMessage ? "min-w-[210px]" : "min-w-[250px]"}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      {/* PLAY/PAUSE TRIGGER */}
      <div className="relative shrink-0">
        <button 
          onClick={togglePlayPause}
          className="w-10 h-10 flex items-center justify-center bg-black/15 hover:bg-black/25 active:scale-95 rounded-full transition-all duration-200 border border-white/5 shadow-sm cursor-pointer"
          title={isPlaying ? "Pause" : "Play Voice Note"}
        >
          {isPlaying ? (
            <Pause size={18} className="text-white fill-white animate-fade-in" />
          ) : (
            <Play size={18} className="text-white fill-white ml-0.5 animate-fade-in" />
          )}
        </button>
        
        {/* NEW/UNREAD INDICATOR */}
        {!own && !hasPlayed && isVoiceMessage && (
          <div 
            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-brand rounded-full border-2 border-app-drawer"
            title="New voice note" 
          />
        )}
      </div>

      {/* WAVEFORM PRECISE SEEK DECK */}
      <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
        <div 
          ref={waveformContainerRef}
          onMouseDown={handleScrub}
          className="relative h-6 w-full cursor-pointer flex items-center gap-[2.5px] select-none group"
          title="Click to seek"
        >
          {finalPeaks.map((peak, idx) => {
            const isPlayedBar = idx <= playedCount;
            return (
              <div 
                key={idx} 
                className={`w-[3px] rounded-full transition-all duration-300 ${
                  isPlayedBar 
                    ? `${activeColorClass} opacity-100 scale-y-105` 
                    : "bg-gray-400/35 hover:bg-gray-400/50"
                }`}
                style={{ 
                  height: `${Math.max(12, peak * 100)}%`
                }}
              />
            );
          })}

          {/* ACTIVE HOVER HANDLE */}
          <div 
            className={`absolute h-2.5 w-2.5 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none`}
            style={{ 
              left: `calc(${progress}% - 5px)`, 
              backgroundColor: isBlue ? "var(--color-brand)" : (own ? "var(--color-app-text-secondary)" : "var(--color-brand)") 
            }}
          />
        </div>

        {/* METADATA SUMMARY & SPEED PREFERENCE */}
        <div className="flex justify-between items-center text-[10px] text-gray-300 font-medium tracking-wide">
          <span>{formatTime(currentTime)}</span>
          <div className="flex items-center gap-2">
            {isVoiceMessage && (
              <button 
                onClick={togglePlaybackRate}
                className="bg-black/20 hover:bg-black/35 px-1.5 py-0.5 rounded text-[9px] font-bold text-white transition active:scale-95 shrink-0"
                title="Toggle playback speed"
              >
                {playbackRate}x
              </button>
            )}
            <span>{formatTime(duration || parseFloat(duration))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CustomAudioPlayer;
