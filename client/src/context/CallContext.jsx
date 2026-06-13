import { createContext, useContext, useEffect, useRef, useState } from "react";
import { socket } from "@socket/socket";
import { toneSynthesizer } from "@utils/toneSynthesizer";
import api from "@services/api";
import toast from "react-hot-toast";

const CallContext = createContext(null);

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCall = () => useContext(CallContext);

export const CallProvider = ({ children }) => {
  const [callState, setCallState] = useState("idle"); // idle, calling, ringing, connecting, connected, rejected, missed, ended, failed
  const [incomingCall, setIncomingCall] = useState(null); // { caller, type, callId }
  const [outgoingCall, setOutgoingCall] = useState(null); // { receiver, type, callId }
  const [activeCall, setActiveCall] = useState(null); // { peer, type, callId, isCaller }

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true); // simulated speaker toggle
  const [callDuration, setCallDuration] = useState(0);

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const timeoutRef = useRef(null);
  const callLoggedRef = useRef(false);
  const callDbIdRef = useRef(null);

  const currentUser = JSON.parse(localStorage.getItem("userInfo")) || {};

  // Clean up streams & peer connection
  const cleanupCall = () => {
    console.log("Cleaning up active call tracks and references...");
    toneSynthesizer.stopAll();

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log(`Stopped track: ${track.kind}`);
      });
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setCallDuration(0);
    setIncomingCall(null);
    setOutgoingCall(null);
    setActiveCall(null);
    setCallState("idle");
    callLoggedRef.current = false;
    callDbIdRef.current = null;
  };

  // WebRTC Setup
  const createPeerConnection = (isCaller, peerId, type, callId) => {
    if (peerConnectionRef.current) {
      console.warn("Peer connection already exists. Closing old one.");
      peerConnectionRef.current.close();
    }

    console.log(`Creating RTCPeerConnection. Caller: ${isCaller}, Peer: ${peerId}`);
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
        console.log(`Added track to connection: ${track.kind}`);
      });
    } else {
      console.warn("No local stream to add tracks from!");
    }

    // ICE Candidate
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("Sending ICE Candidate...");
        socket.emit("call:ice-candidate", {
          candidate: event.candidate,
          peerId,
          callId,
        });
      }
    };

    // Track received
    pc.ontrack = (event) => {
      console.log("Received remote stream track:", event.streams[0]);
      setRemoteStream(event.streams[0]);
    };

    // Connection State Change
    pc.onconnectionstatechange = () => {
      console.log(`WebRTC Connection State: ${pc.connectionState}`);
      if (pc.connectionState === "connected") {
        setCallState("connected");
        // Start duration counter
        if (!durationIntervalRef.current) {
          durationIntervalRef.current = setInterval(() => {
            setCallDuration((prev) => prev + 1);
          }, 1000);
        }
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        console.warn("WebRTC connection lost.");
        handleCallEndByPeer();
      }
    };

    return pc;
  };

  // Initiate call
  const initiateCall = async (receiver, type) => {
    if (callState !== "idle") {
      toast.error("You are already in a call or connecting.");
      return;
    }

    const callId = "call_" + Math.random().toString(36).substr(2, 9);
    console.log(`Initiating ${type} call to ${receiver.username} with ID ${callId}`);

    // Request permissions first
    try {
      const constraints = {
        audio: true,
        video: type === "video" ? { facingMode: "user" } : false,
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      
      setCallState("calling");
      setOutgoingCall({ receiver, type, callId });
      setActiveCall({ peer: receiver, type, callId, isCaller: true });
      toneSynthesizer.playDialTone();

      // Log call initial record on the backend
      try {
        const { data } = await api.post("/call/history", {
          receiverId: receiver._id || receiver.id,
          type,
          status: "missed", // default to missed, updated on connect/reject
        });
        callDbIdRef.current = data._id;
      } catch (err) {
        console.error("Failed to log initial call:", err);
      }

      socket.emit("call:initiate", {
        receiverId: receiver._id || receiver.id,
        callerName: currentUser.username,
        callerAvatar: currentUser.avatar,
        type,
        callId,
        callDbId: callDbIdRef.current
      });

      // 30s ringing timeout
      timeoutRef.current = setTimeout(async () => {
        console.warn("Ringing timeout. Call missed.");
        setCallState("missed");
        toneSynthesizer.playEndTone();

        // Update database to missed
        if (callDbIdRef.current) {
          try {
            await api.patch(`/call/history/${callDbIdRef.current}`, {
              status: "missed",
              duration: 0,
            });
          } catch (e) {
            console.error(e);
          }
        }

        // Notify other peer call was missed
        socket.emit("call:end", {
          peerId: receiver._id || receiver.id,
          callId,
        });

        setTimeout(cleanupCall, 2000);
      }, 30000);

    } catch (err) {
      console.error("Permission denied or device issue:", err);
      toast.error("Microphone and Camera permission is required to start a call.");
      cleanupCall();
    }
  };

  // Accept call
  const acceptCall = async () => {
    if (!incomingCall) return;
    const { caller, type, callId } = incomingCall;
    console.log(`Accepting ${type} call from ${caller.username}`);

    toneSynthesizer.stopAll();

    try {
      const constraints = {
        audio: true,
        video: type === "video" ? { facingMode: "user" } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);

      setCallState("connecting");
      setActiveCall({ peer: caller, type, callId, isCaller: false });

      socket.emit("call:accept", { callerId: caller._id, callId });

      // Build peer connection
      createPeerConnection(false, caller._id, type, callId);

      // We wait for the caller to send us the SDP offer
    } catch (err) {
      console.error("Permission denied or media error on accept:", err);
      toast.error("Failed to access camera or microphone.");
      rejectCall();
    }
  };

  // Reject call
  const rejectCall = async () => {
    if (!incomingCall) return;
    const { caller, callId } = incomingCall;
    console.log(`Rejecting call ${callId} from ${caller.username}`);

    toneSynthesizer.stopAll();
    socket.emit("call:reject", { callerId: caller._id, callId });

    setCallState("rejected");
    toneSynthesizer.playEndTone();
    setTimeout(cleanupCall, 400); // Snappy decline transition
  };

  // End call
  const endCall = async () => {
    if (!activeCall) {
      cleanupCall();
      return;
    }

    const { peer, callId, isCaller } = activeCall;
    console.log(`Ending active call ${callId} with ${peer.username}`);

    socket.emit("call:end", { peerId: peer._id || peer.id, callId });

    // Save history with duration (Fire-and-Forget)
    const finalDuration = callDuration;
    
    if (isCaller && callDbIdRef.current) {
      api.patch(`/call/history/${callDbIdRef.current}`, {
        status: finalDuration > 0 ? "answered" : "missed",
        duration: finalDuration,
      }).catch((err) => console.error("Failed to update call duration:", err));
    }

    toneSynthesizer.stopAll();
    toneSynthesizer.playEndTone();
    cleanupCall(); // Instant cut! No lag or delay
  };

  // Remote peer ended call
  const handleCallEndByPeer = async () => {
    console.log("Active call ended by remote peer.");
    const finalDuration = callDuration;

    if (activeCall) {
      const { isCaller } = activeCall;
      
      if (isCaller && callDbIdRef.current) {
        api.patch(`/call/history/${callDbIdRef.current}`, {
          status: finalDuration > 0 ? "answered" : "missed",
          duration: finalDuration,
        }).catch(() => {});
      }
    }

    toneSynthesizer.stopAll();
    toneSynthesizer.playEndTone();
    setTimeout(cleanupCall, 400); // Snappy transition when peer cuts
  };

  // Toggle Mic
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        console.log(`Audio Track: ${audioTrack.enabled ? "Enabled" : "Muted"}`);
      }
    }
  };

  // Toggle Camera
  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
        console.log(`Video Track: ${videoTrack.enabled ? "Enabled" : "Disabled"}`);
      }
    }
  };

  const handlersRef = useRef({ createPeerConnection, endCall, handleCallEndByPeer });
  useEffect(() => {
    handlersRef.current = { createPeerConnection, endCall, handleCallEndByPeer };
  });

  // Listen to sockets
  useEffect(() => {
    // 1. Incoming Call
    socket.on("call:incoming", ({ caller, type, callId, callDbId }) => {
      console.log(`Socket Received: Incoming ${type} call ${callId} from ${caller.username}`);
      
      if (callState !== "idle") {
        // Automatically reject busy
        socket.emit("call:reject", { callerId: caller._id, callId, reason: "busy" });
        return;
      }

      setCallState("ringing");
      setIncomingCall({ caller, type, callId });
      callDbIdRef.current = callDbId; // Store the shared call history DB record ID
      toneSynthesizer.playIncomingRingtone();
      socket.emit("call:ringing", { callerId: caller._id, callId });
    });

    // 2. Caller receives: Ringing confirmation
    socket.on("call:ringing", () => {
      console.log(`Socket Received: Call is ringing on receiver's end.`);
      if (callState === "calling") {
        setCallState("ringing");
      }
    });

    // 3. Caller receives: Accept call
    socket.on("call:accepted", async ({ callId }) => {
      console.log("Socket Received: Call accepted by receiver!");
      toneSynthesizer.stopAll();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      setCallState("connecting");

      if (activeCall) {
        const { peer, type } = activeCall;
        const pc = handlersRef.current.createPeerConnection(true, peer._id || peer.id, type, callId);

        // Caller creates SDP Offer
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          console.log("SDP Offer Created, sending to receiver...");

          socket.emit("call:offer", {
            offer,
            peerId: peer._id || peer.id,
            callId,
          });
        } catch (err) {
          console.error("Failed to create offer:", err);
          handlersRef.current.endCall();
        }
      }
    });

    // 4. Receiver receives: SDP Offer
    socket.on("call:offer", async ({ offer, callId }) => {
      console.log("Socket Received: WebRTC Offer");
      if (peerConnectionRef.current) {
        const pc = peerConnectionRef.current;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          console.log("SDP Answer Created, sending to caller...");

          if (activeCall) {
            socket.emit("call:answer", {
              answer,
              peerId: activeCall.peer._id || activeCall.peer.id,
              callId,
            });
          }
        } catch (err) {
          console.error("Failed to handle offer / create answer:", err);
          handlersRef.current.endCall();
        }
      }
    });

    // 5. Caller receives: SDP Answer
    socket.on("call:answer", async ({ answer }) => {
      console.log("Socket Received: WebRTC Answer");
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error("Failed to set remote answer description:", err);
          handlersRef.current.endCall();
        }
      }
    });

    // 6. ICE Candidates exchange
    socket.on("call:ice-candidate", async ({ candidate }) => {
      console.log("Socket Received: ICE Candidate");
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Failed to add ICE candidate:", err);
        }
      }
    });

    // 7. Caller receives: Rejected call from receiver
    socket.on("call:rejected", () => {
      console.log("Socket Received: Call rejected.");
      setCallState("rejected");
      toneSynthesizer.playEndTone();

      // Update shared call history to rejected (Fire-and-Forget)
      if (callDbIdRef.current) {
        api.patch(`/call/history/${callDbIdRef.current}`, {
          status: "rejected",
          duration: 0,
        }).catch((err) => console.error("Failed to update rejected call history:", err));
      }

      setTimeout(cleanupCall, 400);
    });

    // 8. Call ended by peer
    socket.on("call:ended", ({ reason }) => {
      console.log(`Socket Received: Call ended. Reason: ${reason}`);
      if (reason === "peer_disconnected") {
        toast.error("Call disconnected: Connection lost.");
      }
      handlersRef.current.handleCallEndByPeer();
    });

    // 9. Call failed
    socket.on("call:failed", ({ reason }) => {
      console.warn(`Socket Received: Call failed. Reason: ${reason}`);
      toneSynthesizer.stopAll();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (reason === "receiver_busy") {
        toast.error("User is busy on another call.");
        setCallState("rejected");
      } else if (reason === "you_busy") {
        toast.error("You are busy on another call.");
        setCallState("rejected");
      } else if (reason === "offline") {
        toast.error("User is currently offline.");
        setCallState("failed");
      } else {
        toast.error("Call failed to connect.");
        setCallState("failed");
      }

      toneSynthesizer.playEndTone();
      setTimeout(cleanupCall, 2000);
    });

    return () => {
      socket.off("call:incoming");
      socket.off("call:ringing");
      socket.off("call:accepted");
      socket.off("call:offer");
      socket.off("call:answer");
      socket.off("call:ice-candidate");
      socket.off("call:rejected");
      socket.off("call:ended");
      socket.off("call:failed");
    };
  }, [callState, incomingCall, outgoingCall, activeCall, callDuration]);

  return (
    <CallContext.Provider
      value={{
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
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleCamera,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};
