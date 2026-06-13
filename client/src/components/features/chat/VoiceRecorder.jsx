import { useState, useRef, useEffect, useMemo } from "react";
import { Trash2, SendHorizonal, Pause, Play, Check, RotateCcw, Volume2 } from "lucide-react";
import toast from "react-hot-toast";
import { useTheme } from "@context/ThemeContext";

function VoiceRecorder({ onSend, onCancel }) {
  const { theme } = useTheme();
  const brandColorRef = useRef("#4f46e5");
  const brandLightRef = useRef("#818cf8");

  useEffect(() => {
    const rootStyles = getComputedStyle(document.documentElement);
    const brand = rootStyles.getPropertyValue("--brand-color").trim();
    if (brand) {
      brandColorRef.current = brand;
      if (theme === "dark") {
        brandLightRef.current = "#5b82a8";
      } else {
        brandLightRef.current = "#14b8a6"; // beautiful teal highlight
      }
    }
  }, [theme]);

  const [recording, setRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);
  
  // Real-time calculated amplitude level peaks
  const [recordedPeaks, setRecordedPeaks] = useState([]);
  
  // Local preview state
  const [previewBlob, setPreviewBlob] = useState(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);

  const [isPreviewDragging, setIsPreviewDragging] = useState(false);
  const [previewHoveredIndex, setPreviewHoveredIndex] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const peakSamplerRef = useRef(null);
  const localAudioRef = useRef(null);
  const previewWaveformContainerRef = useRef(null);

  /* VISUALIZER REFS */
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);

  /* STRICT REFS */
  const startedRef = useRef(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      startRecording();
    }

    return () => {
      stopRecording();
      cleanupVisualizer();
      if (peakSamplerRef.current) clearInterval(peakSamplerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanupVisualizer() {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
    }
  }

  function startVisualizer(stream) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);

      source.connect(analyser);
      analyser.fftSize = 64; // Thicker visualizer bars

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const canvas = canvasRef.current;
      
      if (!canvas) return;
      const canvasCtx = canvas.getContext("2d");

      const draw = () => {
        animationRef.current = requestAnimationFrame(draw);
        
        if (analyserRef.current && !isPaused) {
          analyserRef.current.getByteFrequencyData(dataArray);
        } else if (isPaused) {
          // Flatten visualizer when paused
          dataArray.fill(0);
        }

        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 1.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height * 0.9;
          
          const gradient = canvasCtx.createLinearGradient(0, canvas.height, 0, 0);
          gradient.addColorStop(0, brandColorRef.current);
          gradient.addColorStop(1, brandLightRef.current);
          
          canvasCtx.fillStyle = gradient;
          
          const y = canvas.height - Math.max(3, barHeight);
          canvasCtx.beginPath();
          canvasCtx.roundRect(x, y, barWidth - 1.5, Math.max(3, barHeight), 2.5);
          canvasCtx.fill();

          x += barWidth;
        }
      };
      draw();
    } catch (err) {
      console.log("Canvas visualizer error:", err);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setRecordedPeaks([]);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (cancelledRef.current) return;
        
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        setPreviewBlob(audioBlob);
        setPreviewDuration(duration || 1);
      };

      mediaRecorder.start();
      setRecording(true);
      setIsPaused(false);
      startVisualizer(stream);

      // Start duration counter
      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      // Sample raw amplitude peaks dynamically every 150ms
      peakSamplerRef.current = setInterval(() => {
        if (!analyserRef.current || isPaused) return;
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Fetch average loudness level
        const avg = dataArray.reduce((acc, val) => acc + val, 0) / bufferLength;
        const norm = Math.max(0.06, Math.min(1.0, avg / 130)); // Normalization
        setRecordedPeaks((prev) => [...prev, norm]);
      }, 150);

    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error("Microphone permission denied or unavailable");
      onCancel();
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      clearInterval(timerIntervalRef.current);
      if (peakSamplerRef.current) clearInterval(peakSamplerRef.current);
      
      // Stop all mic tracks
      if (audioContextRef.current) {
        cleanupVisualizer();
      }
    }
  }

  const handlePauseToggle = () => {
    if (!mediaRecorderRef.current) return;

    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      // Resume timer
      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      // Pause timer
      clearInterval(timerIntervalRef.current);
    }
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    audioChunksRef.current = [];
    stopRecording();
    setIsCancelling(true);
    setTimeout(() => {
      onCancel();
    }, 850);
  };

  const handleStopAndPreview = () => {
    stopRecording();
  };

  // Interpolates/Buckets recorded peaks to exactly 40 elements for neat UI rendering
  const capPeaks = (peaksArray, targetCount = 40) => {
    if (!peaksArray || peaksArray.length === 0) {
      // Pure deterministic fallback peaks to satisfy react-hooks/purity
      return Array.from({ length: targetCount }, (_, i) => {
        return Number((0.15 + (Math.sin(i * 0.5) * 0.15)).toFixed(2));
      });
    }
    if (peaksArray.length <= targetCount) {
      const padded = [...peaksArray];
      while (padded.length < targetCount) {
        padded.push(padded[padded.length - 1] || 0.15);
      }
      return padded;
    }
    // Bucketing Downsampler
    const step = peaksArray.length / targetCount;
    const result = [];
    for (let i = 0; i < targetCount; i++) {
      const start = Math.floor(i * step);
      const end = Math.floor((i + 1) * step);
      const slice = peaksArray.slice(start, end);
      const avg = slice.reduce((a, b) => a + b, 0) / (slice.length || 1);
      result.push(Number(Math.max(0.08, avg).toFixed(2)));
    }
    return result;
  };

  const handleSend = () => {
    if (!previewBlob) return;

    const audioFile = new File([previewBlob], `voice-message-${Date.now()}.webm`, {
      type: "audio/webm",
    });

    const finalPeaks = capPeaks(recordedPeaks, 40);
    onSend(audioFile, previewDuration, finalPeaks);
  };

  const handleRerecord = () => {
    setPreviewBlob(null);
    setIsPreviewPlaying(false);
    setPreviewProgress(0);
    setDuration(0);
    startedRef.current = false;
    cancelledRef.current = false;
    startRecording();
  };

  /* PREVIEW AUDIO EVENT LISTENERS */
  const togglePlayPausePreview = () => {
    const audio = localAudioRef.current;
    if (!audio) return;

    if (isPreviewPlaying) {
      audio.pause();
      setIsPreviewPlaying(false);
    } else {
      audio.play().catch(err => console.error(err));
      setIsPreviewPlaying(true);
    }
  };

  const handlePreviewTimeUpdate = () => {
    const audio = localAudioRef.current;
    if (!audio || isPreviewDragging) return;
    setPreviewCurrentTime(audio.currentTime);
    setPreviewProgress((audio.currentTime / (audio.duration || 1)) * 100);
  };

  const handlePreviewEnded = () => {
    setIsPreviewPlaying(false);
    setPreviewProgress(0);
    setPreviewCurrentTime(0);
  };

  const handlePreviewScrub = (e) => {
    if (!previewWaveformContainerRef.current || !previewDuration) return;
    const rect = previewWaveformContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const clickedPercentage = Math.max(0, Math.min(100, (clickX / width) * 100));

    const audio = localAudioRef.current;
    if (audio) {
      audio.currentTime = (clickedPercentage / 100) * previewDuration;
    }
    setPreviewCurrentTime((clickedPercentage / 100) * previewDuration);
    setPreviewProgress(clickedPercentage);
  };

  const handlePreviewMouseDown = (e) => {
    setIsPreviewDragging(true);
    handlePreviewScrub(e);
  };

  useEffect(() => {
    const handlePreviewMouseMoveGlobal = (e) => {
      if (!isPreviewDragging || !previewWaveformContainerRef.current || !previewDuration) return;
      const rect = previewWaveformContainerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const clickedPercentage = Math.max(0, Math.min(100, (clickX / width) * 100));

      const audio = localAudioRef.current;
      if (audio) {
        audio.currentTime = (clickedPercentage / 100) * previewDuration;
      }
      setPreviewCurrentTime((clickedPercentage / 100) * previewDuration);
      setPreviewProgress(clickedPercentage);
    };

    const handlePreviewMouseUpGlobal = () => {
      setIsPreviewDragging(false);
    };

    if (isPreviewDragging) {
      window.addEventListener("mousemove", handlePreviewMouseMoveGlobal);
      window.addEventListener("mouseup", handlePreviewMouseUpGlobal);
    }

    return () => {
      window.removeEventListener("mousemove", handlePreviewMouseMoveGlobal);
      window.removeEventListener("mouseup", handlePreviewMouseUpGlobal);
    };
  }, [isPreviewDragging, previewDuration]);

  const handlePreviewMouseMove = (e) => {
    if (!previewWaveformContainerRef.current) return;
    const rect = previewWaveformContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(100, (clickX / width) * 100));
    const index = Math.floor((percentage / 100) * sampleWaves.length);
    setPreviewHoveredIndex(index);
  };

  const handlePreviewMouseLeave = () => {
    setPreviewHoveredIndex(null);
  };

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const sampleWaves = useMemo(() => {
    return capPeaks(recordedPeaks, 38);
  }, [recordedPeaks]);

  const playedPreviewCount = Math.floor((previewProgress / 100) * sampleWaves.length);

  if (isCancelling) {
    return (
      <div className="flex-1 flex items-center bg-app-header/95 backdrop-blur-md px-3 py-2 rounded-2xl border border-app-border shadow-2xl justify-start animate-fade-in relative z-10 select-none min-h-[56px] overflow-hidden">
        {/* CSS KEYFRAMES STYLES */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes trash-lid-open {
            0% { transform: translateY(0) rotate(0deg); }
            20% { transform: translateY(-6px) rotate(-45deg); }
            75% { transform: translateY(-6px) rotate(-45deg); }
            100% { transform: translateY(0) rotate(0deg); }
          }
          @keyframes mic-fly-to-trash {
            0% {
              transform: translate(160px, 0px) scale(1) rotate(0deg);
              opacity: 1;
            }
            15% {
              transform: translate(140px, -20px) scale(1.1) rotate(-15deg);
              opacity: 1;
            }
            80% {
              transform: translate(25px, 8px) scale(0.3) rotate(-270deg);
              opacity: 0.6;
            }
            100% {
              transform: translate(8px, 12px) scale(0) rotate(-360deg);
              opacity: 0;
            }
          }
          @keyframes trash-can-shake {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.15); }
            75% { transform: scale(0.92); }
          }
        `}} />

        {/* TRASH CAN WITH ANIMATING LID */}
        <div className="relative w-10 h-10 flex items-center justify-center shrink-0 ml-1">
          <div className="absolute top-2 w-5 h-1 bg-red-500 rounded-sm origin-left animate-[trash-lid-open_0.8s_ease-in-out_forwards]" style={{ left: "10px" }} />
          <div className="absolute bottom-2.5 w-5 h-4.5 border-2 border-t-0 border-red-500 rounded-b-md flex justify-around p-0.5 animate-[trash-can-shake_0.2s_ease-in-out_0.6s_1]" style={{ left: "10px" }}>
            <div className="w-0.5 bg-red-500/60 h-full rounded-full" />
            <div className="w-0.5 bg-red-500/60 h-full rounded-full" />
          </div>
        </div>

        {/* FLYING MICROPHONE */}
        <div className="absolute w-8 h-8 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-500 animate-[mic-fly-to-trash_0.8s_cubic-bezier(0.25,1,0.5,1)_forwards]">
          <Volume2 size={16} className="animate-pulse" />
        </div>

        <span className="text-red-400/90 text-xs font-semibold tracking-wider ml-6 animate-pulse select-none">
          Discarding recording...
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center bg-app-header/95 backdrop-blur-md px-3 py-2 rounded-2xl border border-app-border shadow-2xl justify-between animate-fade-in relative z-10 select-none">
      
      {/* ==========================================
          STATE 1: ACTIVE RECORDING OR PAUSED STATE
          ========================================== */}
      {!previewBlob ? (
        <div className="flex items-center gap-4 flex-1 justify-between">
          {/* TRASH CAN CANCEL */}
          <button
            onClick={handleCancel}
            className="w-10 h-10 flex items-center justify-center rounded-full text-app-text-secondary hover:text-red-500 hover:bg-red-500/10 transition-all duration-200 cursor-pointer"
            title="Discard Recording"
          >
            <Trash2 size={20} />
          </button>

          {/* PULSING RECORD INDICATOR & TIMER */}
          <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-xl border border-red-500/20 shrink-0">
            <div className={`w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.7)] ${!isPaused && "animate-pulse"}`} />
            <span className="text-red-400 text-xs font-semibold tracking-wider tabular-nums">
              {formatDuration(duration)}
            </span>
          </div>

          {/* DYNAMIC CANVAS GRAPH WAVEFORM */}
          <div className="flex-1 h-9 flex items-center justify-center overflow-hidden px-4">
            <canvas
              ref={canvasRef}
              width={160}
              height={36}
              className="w-full max-w-[200px] h-full"
            />
          </div>

          {/* INTERACTION DECK (Pause / Finish) */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePauseToggle}
              className={`w-10 h-10 flex items-center justify-center rounded-full border transition-all duration-200 cursor-pointer ${
                isPaused 
                  ? "bg-brand/15 border-brand/35 text-brand hover:bg-brand/25" 
                  : "bg-app-hover border border-app-border text-app-text-secondary hover:text-app-text-primary"
              }`}
              title={isPaused ? "Resume Recording" : "Pause Recording"}
            >
              {isPaused ? <Play size={16} className="fill-brand text-brand border-none" /> : <Pause size={16} />}
            </button>

            <button
              onClick={handleStopAndPreview}
              className="w-10 h-10 flex items-center justify-center bg-brand hover:opacity-90 text-white rounded-full transition-all duration-200 shadow-md cursor-pointer"
              title="Stop and Preview"
            >
              <Check size={18} />
            </button>
          </div>
        </div>
      ) : (
        /* ==========================================
           STATE 2: LOCAL AUDIBLE PREVIEW STATE
           ========================================== */
        <div className="flex items-center gap-4 flex-1 justify-between">
          <audio
            ref={localAudioRef}
            src={URL.createObjectURL(previewBlob)}
            onTimeUpdate={handlePreviewTimeUpdate}
            onEnded={handlePreviewEnded}
          />

          {/* DISCARD PREVIEW */}
          <button
            onClick={handleCancel}
            className="w-10 h-10 flex items-center justify-center rounded-full text-app-text-secondary hover:text-red-500 hover:bg-red-500/10 transition-all duration-200 cursor-pointer"
            title="Discard"
          >
            <Trash2 size={20} />
          </button>

          {/* PLAY/PAUSE PREVIEW */}
          <button
            onClick={togglePlayPausePreview}
            className="w-10 h-10 flex items-center justify-center bg-brand hover:brightness-110 text-white rounded-full transition-all duration-300 shadow-md active:scale-95 shrink-0 cursor-pointer border border-white/10"
            title={isPreviewPlaying ? "Pause Preview" : "Play Preview"}
          >
            {isPreviewPlaying ? <Pause size={16} className="text-white fill-white animate-fade-in" /> : <Play size={16} className="text-white fill-white ml-0.5 animate-fade-in" />}
          </button>

          {/* DYNAMIC STATIC WAVEFORM OF RECORDED PEAKS */}
          <div 
            ref={previewWaveformContainerRef}
            onMouseDown={handlePreviewMouseDown}
            onMouseMove={handlePreviewMouseMove}
            onMouseLeave={handlePreviewMouseLeave}
            className="flex-1 flex items-center gap-[2px] h-7 justify-center max-w-[200px] select-none cursor-pointer relative group"
            title="Drag or click to seek"
          >
            {sampleWaves.map((peak, idx) => {
              const isPlayed = idx <= playedPreviewCount;
              const isHovered = previewHoveredIndex !== null && idx <= previewHoveredIndex;
              
              let barColor;
              let barOpacity;
              
              if (isPlayed) {
                barColor = "var(--brand-color)";
                barOpacity = "opacity-100";
              } else if (isHovered) {
                barColor = "var(--brand-color)";
                barOpacity = "opacity-70";
              } else {
                barColor = "currentColor";
                barOpacity = "opacity-30 group-hover:opacity-40";
              }

              // Fisheye zoom effect on hover
              let scaleY = 1;
              if (previewHoveredIndex !== null) {
                const distance = Math.abs(idx - previewHoveredIndex);
                if (distance === 0) scaleY = 1.35;
                else if (distance === 1) scaleY = 1.2;
                else if (distance === 2) scaleY = 1.08;
              } else if (isPlayed && isPreviewPlaying) {
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
              className={`absolute h-3 w-3 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition-all duration-200 pointer-events-none flex items-center justify-center -translate-y-1/2 top-1/2 ${
                isPreviewDragging || previewHoveredIndex !== null ? "opacity-100 scale-110" : "opacity-0"
              }`}
              style={{ 
                left: `calc(${previewProgress}% - 6px)`, 
                border: "2px solid var(--brand-color)"
              }}
            >
              <div 
                className="w-1 h-1 rounded-full bg-brand" 
              />
            </div>
          </div>

          {/* PREVIEW COUNTER */}
          <span className="text-app-text-primary text-xs font-semibold tabular-nums tracking-wide font-mono">
            {formatDuration(isPreviewPlaying ? previewCurrentTime : previewDuration)}
          </span>

          {/* RERECORD & SEND CONTROL */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRerecord}
              className="w-10 h-10 flex items-center justify-center bg-app-hover border border-app-border text-app-text-secondary hover:text-app-text-primary rounded-full transition-all duration-200 cursor-pointer"
              title="Re-record voice note"
            >
              <RotateCcw size={16} />
            </button>

            <button
              onClick={handleSend}
              className="w-10 h-10 flex items-center justify-center bg-brand hover:opacity-90 text-white rounded-full transition-all duration-200 shadow-md cursor-pointer"
              title="Send Voice Message"
            >
              <SendHorizonal size={18} className="ml-0.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default VoiceRecorder;
