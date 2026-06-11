import React, { useEffect, useRef, useState } from "react";
import { useCall } from "@context/CallContext";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, VolumeX, Maximize2, Minimize2 } from "lucide-react";

const CallOverlay = () => {
  const {
    callState,
    incomingCall,
    outgoingCall,
    activeCall,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    isSpeakerOn,
    setIsSpeakerOn,
    callDuration,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pipPosition, setPipPosition] = useState({ x: 24, y: 100 }); // bottom-right margin offsets
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Stable callback refs to prevent video blinking on re-render / timer updates
  const bindLocalVideo = React.useCallback((el) => {
    localVideoRef.current = el;
    if (el && localStream) {
      if (el.srcObject !== localStream) {
        el.srcObject = localStream;
        console.log("🎥 Stably bound local video stream");
      }
    }
  }, [localStream]);

  const bindRemoteVideo = React.useCallback((el) => {
    remoteVideoRef.current = el;
    if (el && remoteStream) {
      if (el.srcObject !== remoteStream) {
        el.srcObject = remoteStream;
        console.log("🎥 Stably bound remote video stream");
      }
    }
  }, [remoteStream]);

  const bindRemoteAudio = React.useCallback((el) => {
    remoteAudioRef.current = el;
    if (el && remoteStream) {
      if (el.srcObject !== remoteStream) {
        el.srcObject = remoteStream;
        console.log("🔊 Stably bound remote audio stream");
      }
    }
  }, [remoteStream]);


  const formatDuration = (s) => {
    const mins = Math.floor(s / 60).toString().padStart(2, "0");
    const secs = (s % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  // Draggable PIP Self Preview handlers
  const handleMouseDown = (e) => {
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX - pipPosition.x,
      y: e.clientY - pipPosition.y,
    };
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    const newX = e.clientX - dragStartRef.current.x;
    const newY = e.clientY - dragStartRef.current.y;

    // Bounds boundaries
    const boundX = Math.max(10, Math.min(window.innerWidth - 180, newX));
    const boundY = Math.max(10, Math.min(window.innerHeight - 250, newY));

    setPipPosition({ x: boundX, y: boundY });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  useEffect(() => {
    if (isDraggingRef.current) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [pipPosition]);

  if (callState === "idle") return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090d16]/95 backdrop-blur-md select-none text-white overflow-hidden font-sans">
      {/* Hidden audio element for voice calls to play remote speaker track */}
      {activeCall?.type === "voice" && <audio ref={bindRemoteAudio} autoPlay playsInline />}

      {/* =========================
         1. INCOMING CALL SCREEN
         ========================= */}
      {callState === "ringing" && incomingCall && (
        <div className="flex flex-col items-center justify-between h-full py-16 px-6 z-10 w-full max-w-md animate-fade-in">
          <div className="flex flex-col items-center text-center space-y-4 mt-12">
            <span className="bg-brand/20 text-brand text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full border border-brand/30 animate-pulse">
              Incoming Call
            </span>
            <h1 className="text-3xl font-light text-slate-100">{incomingCall.caller?.username}</h1>
            <p className="text-sm text-slate-400">
              Vertex {incomingCall.type === "video" ? "Video" : "Voice"} Call...
            </p>
          </div>

          {/* Glowing Avatar */}
          <div className="relative my-12">
            <div className="absolute inset-0 rounded-full bg-brand/10 border border-brand/20 animate-ping opacity-60 scale-125" />
            <div className="absolute inset-0 rounded-full bg-brand/20 animate-pulse opacity-40 scale-110" />
            {incomingCall.caller?.avatar ? (
              <img
                src={incomingCall.caller.avatar}
                alt="Avatar"
                className="w-36 h-36 rounded-full object-cover border-4 border-[#1e293b] shadow-2xl relative z-10"
              />
            ) : (
              <div className="w-36 h-36 rounded-full bg-slate-800 flex items-center justify-center text-4xl border-4 border-[#1e293b] text-slate-200 relative z-10 font-bold">
                {incomingCall.caller?.username?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-12 mb-12">
            <button
              onClick={rejectCall}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-2xl hover:scale-105 active:scale-95 transition cursor-pointer"
              title="Decline"
            >
              <PhoneOff size={26} />
            </button>
            <button
              onClick={acceptCall}
              className="w-16 h-16 rounded-full bg-brand hover:opacity-90 flex items-center justify-center text-white shadow-2xl hover:scale-105 active:scale-95 transition cursor-pointer"
              title="Accept"
            >
              <Phone size={26} className="animate-bounce" />
            </button>
          </div>
        </div>
      )}

      {/* =========================
         2. OUTGOING / CALLING SCREEN
         ========================= */}
      {(callState === "calling" || (callState === "ringing" && outgoingCall)) && outgoingCall && (
        <div className="flex flex-col items-center justify-between h-full py-16 px-6 z-10 w-full max-w-md animate-fade-in">
          <div className="flex flex-col items-center text-center space-y-4 mt-12">
            <span className="bg-brand/20 text-brand text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full border border-brand/30 animate-pulse">
              {callState === "ringing" ? "Ringing" : "Calling"}
            </span>
            <h1 className="text-3xl font-light text-slate-100">{outgoingCall.receiver?.username}</h1>
            <p className="text-sm text-slate-400">
              Vertex {outgoingCall.type === "video" ? "Video" : "Voice"} Call...
            </p>
          </div>

          {/* Animated pulsing calling ring */}
          <div className="relative my-12">
            <div className="absolute inset-0 rounded-full bg-brand/10 border border-brand/20 animate-ping opacity-60 scale-125" />
            <div className="absolute inset-0 rounded-full bg-brand/20 animate-pulse opacity-40 scale-110" />
            {outgoingCall.receiver?.avatar ? (
              <img
                src={outgoingCall.receiver.avatar}
                alt="Avatar"
                className="w-36 h-36 rounded-full object-cover border-4 border-[#1e293b] shadow-2xl relative z-10"
              />
            ) : (
              <div className="w-36 h-36 rounded-full bg-slate-800 flex items-center justify-center text-4xl border-4 border-[#1e293b] text-slate-200 relative z-10 font-bold">
                {outgoingCall.receiver?.username?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="mb-12">
            <button
              onClick={endCall}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-2xl hover:scale-105 active:scale-95 transition cursor-pointer"
              title="Cancel Call"
            >
              <PhoneOff size={26} />
            </button>
          </div>
        </div>
      )}

      {/* =========================
         3. CONNECTING STATE
         ========================= */}
      {callState === "connecting" && (
        <div className="flex flex-col items-center justify-center space-y-6 z-10 animate-fade-in">
          <div className="p-4 bg-brand/10 rounded-full border border-brand/20 animate-spin w-16 h-16 border-t-brand" />
          <h2 className="text-xl font-light text-slate-300">Connecting WebRTC Session...</h2>
          <p className="text-xs text-slate-500">Resolving STUN ICE candidates...</p>
        </div>
      )}

      {/* =========================
         4. CONNECTED VOICE CALL SCREEN
         ========================= */}
      {callState === "connected" && activeCall?.type === "voice" && (
        <div className="flex flex-col items-center justify-between h-full py-16 px-6 z-10 w-full max-w-md animate-fade-in">
          {/* Top Info */}
          <div className="flex flex-col items-center text-center space-y-3 mt-12">
            <h1 className="text-3xl font-light text-slate-100 tracking-wide">{activeCall.peer?.username}</h1>
            <div className="flex items-center gap-2.5 bg-brand/10 backdrop-blur-xl px-5 py-2 rounded-full border border-brand/30 shadow-[0_8px_32px_rgba(0,0,0,0.37)]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
              <span className="text-brand font-mono font-semibold tracking-widest text-base">
                {formatDuration(callDuration)}
              </span>
            </div>
          </div>

          {/* Central Speaker profile */}
          <div className="relative my-12">
            <div className="absolute inset-0 rounded-full bg-brand/5 border border-brand/10 animate-pulse opacity-40 scale-125" />
            {activeCall.peer?.avatar ? (
              <img
                src={activeCall.peer.avatar}
                alt="Avatar"
                className="w-36 h-36 rounded-full object-cover border-4 border-[#1e293b] shadow-2xl relative z-10"
              />
            ) : (
              <div className="w-36 h-36 rounded-full bg-slate-800 flex items-center justify-center text-4xl border-4 border-[#1e293b] text-slate-200 relative z-10 font-bold">
                {activeCall.peer?.username?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Call Controls Bar */}
          <div className="flex items-center gap-6 mb-12 bg-[#0f172a]/60 px-8 py-4.5 rounded-3xl border border-white/5 backdrop-blur-md shadow-2xl">
            {/* Mute Mic */}
            <button
              onClick={toggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition cursor-pointer hover:scale-105 active:scale-95 ${isMuted ? "bg-red-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              title={isMuted ? "Unmute Mic" : "Mute Mic"}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            {/* End Call */}
            <button
              onClick={endCall}
              className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg hover:scale-105 active:scale-95 transition cursor-pointer"
              title="Hang Up"
            >
              <PhoneOff size={24} />
            </button>

            {/* Speaker Toggle */}
            <button
              onClick={() => setIsSpeakerOn(!isSpeakerOn)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition cursor-pointer hover:scale-105 active:scale-95 ${!isSpeakerOn ? "bg-amber-500/20 text-amber-500 border border-amber-500/30" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              title={isSpeakerOn ? "Speaker off" : "Speaker on"}
            >
              {isSpeakerOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
          </div>
        </div>
      )}

      {/* =========================
         5. CONNECTED VIDEO CALL SCREEN
         ========================= */}
      {callState === "connected" && activeCall?.type === "video" && (
        <div className="relative w-full h-full flex flex-col justify-between transition-all duration-300">
          {/* Main Remote Video Window */}
          <div className="absolute inset-0 bg-[#000000] w-full h-full flex items-center justify-center">
            {remoteStream ? (
              <video
                ref={bindRemoteVideo}
                autoPlay
                playsInline
                className="w-full h-full object-cover transition-opacity duration-300"
              />
            ) : (
              <div className="flex flex-col items-center space-y-4 animate-pulse">
                {activeCall.peer?.avatar ? (
                  <img
                    src={activeCall.peer.avatar}
                    alt="Avatar"
                    className="w-28 h-28 rounded-full object-cover border-2 border-slate-700 shadow-xl"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-full bg-slate-800 flex items-center justify-center text-3xl font-bold text-slate-300">
                    {activeCall.peer?.username?.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-slate-400 text-sm font-light">Waiting for video stream...</span>
              </div>
            )}
          </div>

          {/* Floating PIP Local Video Window (Draggable) */}
          <div
            onMouseDown={handleMouseDown}
            style={{
              left: `${pipPosition.x}px`,
              top: `${pipPosition.y}px`,
            }}
            className="absolute w-32 h-44 md:w-38 md:h-52 rounded-2xl border border-white/20 bg-[#0f172a]/70 backdrop-blur-md shadow-2xl overflow-hidden cursor-move z-40 transition-shadow duration-300 hover:shadow-cyan-500/10"
          >
            {localStream && !isCameraOff ? (
              <video
                ref={bindLocalVideo}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover pointer-events-none"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-800/90 pointer-events-none">
                <VideoOff size={24} className="text-slate-500" />
              </div>
            )}
            <div className="absolute bottom-1.5 left-2 bg-black/60 px-2 py-0.5 rounded text-[9px] text-slate-300 select-none">
              You
            </div>
          </div>

          {/* Header Controls overlay */}
          <div className="relative z-10 flex items-center justify-between p-5 bg-gradient-to-b from-black/80 via-black/40 to-transparent w-full">
            <div className="flex items-center gap-4">
              {activeCall.peer?.avatar ? (
                <img
                  src={activeCall.peer.avatar}
                  alt="Avatar"
                  className="w-11 h-11 rounded-full object-cover border-2 border-white/20 shadow-md"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-white border-2 border-white/20 shadow-md">
                  {activeCall.peer?.username?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col">
                <h2 className="text-base font-semibold text-slate-100 leading-tight">{activeCall.peer?.username}</h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_#10b981]" />
                  <span className="text-[11px] text-slate-300 font-mono tracking-wider font-medium">
                    {formatDuration(callDuration)}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2.5 bg-black/40 hover:bg-black/60 rounded-xl transition cursor-pointer text-slate-300 hover:text-white border border-white/5"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>

          {/* Footer Controls overlay */}
          <div className="relative z-10 flex justify-center pb-8 pt-4 bg-gradient-to-t from-black/70 to-transparent w-full">
            <div className="flex items-center gap-5 bg-black/40 backdrop-blur-md px-7 py-3.5 rounded-3xl border border-white/5 shadow-2xl">
              {/* Toggle Video */}
              <button
                onClick={toggleCamera}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition cursor-pointer hover:scale-105 active:scale-95 ${isCameraOff ? "bg-red-500 text-white" : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
                  }`}
                title={isCameraOff ? "Turn Camera On" : "Turn Camera Off"}
              >
                {isCameraOff ? <VideoOff size={18} /> : <Video size={18} />}
              </button>

              {/* End Call */}
              <button
                onClick={endCall}
                className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg hover:scale-105 active:scale-95 transition cursor-pointer"
                title="Hang Up"
              >
                <PhoneOff size={22} />
              </button>

              {/* Toggle Mic */}
              <button
                onClick={toggleMute}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition cursor-pointer hover:scale-105 active:scale-95 ${isMuted ? "bg-red-500 text-white" : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
                  }`}
                title={isMuted ? "Unmute Mic" : "Mute Mic"}
              >
                {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================
         6. POST CALL STATES
         ========================= */}
      {(callState === "rejected" || callState === "ended" || callState === "failed" || callState === "missed") && (
        <div className="flex flex-col items-center justify-center space-y-4 z-10 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-500">
            <PhoneOff size={28} />
          </div>
          <h2 className="text-2xl font-light text-slate-200 capitalize">
            Call {callState}
          </h2>
          <p className="text-xs text-slate-500">Session terminated successfully.</p>
        </div>
      )}
    </div>
  );
};

export default CallOverlay;
