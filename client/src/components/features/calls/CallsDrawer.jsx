import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, Search, Loader } from "lucide-react";
import { useEscapeKey } from "@hooks/useEscapeKey";
import { useCall } from "@context/CallContext";
import api from "@services/api";
import toast from "react-hot-toast";

function CallsDrawer({ onClose }) {
  const [callLogs, setCallLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const { initiateCall } = useCall();

  // Bind centralized Escape key helper for drawer dismissal. Priority: 7
  useEscapeKey(onClose, true, 7);

  const fetchCallLogs = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/call/history");
      setCallLogs(data || []);
    } catch (err) {
      console.error("Failed to fetch call history:", err);
      toast.error("Failed to load call history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const handle = requestAnimationFrame(() => {
      if (active) fetchCallLogs();
    });
    return () => {
      active = false;
      cancelAnimationFrame(handle);
    };
  }, [fetchCallLogs]);

  const formatDuration = (s) => {
    if (!s) return "0s";
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatTimestamp = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    
    const isToday =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();

    const options = { hour: "numeric", minute: "2-digit" };
    if (isToday) {
      return `Today, ${date.toLocaleTimeString([], options)}`;
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return `Yesterday, ${date.toLocaleTimeString([], options)}`;
    }

    return `${date.toLocaleDateString([], { month: "short", day: "numeric" })}, ${date.toLocaleTimeString([], options)}`;
  };

  const currentUser = JSON.parse(localStorage.getItem("userInfo")) || {};
  const currentUserId = currentUser.id || currentUser._id;

  const filteredLogs = callLogs.filter((log) => {
    const peer = log.caller?._id === currentUserId ? log.receiver : log.caller;
    if (!peer) return false;
    return peer.username?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="absolute inset-0 bg-app-drawer text-app-text-primary z-50 flex flex-col transition-all duration-300 transform translate-x-0 select-none">
      {/* HEADER */}
      <div className="h-[60px] bg-app-header flex items-center p-4 gap-4 border-b border-app-border shrink-0">
        <button
          onClick={onClose}
          className="p-1.5 text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover rounded-full transition cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="text-app-text-primary font-semibold text-lg">Call Log History</span>
      </div>

      {/* SEARCH BAR */}
      <div className="p-3 bg-app-drawer shrink-0 border-b border-app-border">
        <div className="flex items-center gap-3 bg-app-hover px-4 py-2 rounded-xl border border-app-border">
          <Search size={18} className="text-app-text-secondary" />
          <input
            type="text"
            placeholder="Search contacts in call logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-sm text-app-text-primary placeholder:text-app-text-secondary w-full"
          />
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center space-y-3">
            <Loader size={28} className="animate-spin text-brand" />
            <span className="text-sm text-app-text-secondary">Retrieving call logs...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="p-4 bg-app-hover rounded-full border border-app-border text-app-text-secondary">
              <Phone size={36} />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-app-text-primary text-base">No Call History</h3>
              <p className="text-xs text-app-text-secondary max-w-[280px]">
                {searchQuery ? "No matches found for this search." : "Your recent voice and video call transactions will appear here."}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-app-border">
            {filteredLogs.map((log) => {
              const isOutgoing = log.caller?._id === currentUserId;
              const peer = isOutgoing ? log.receiver : log.caller;

              if (!peer) return null;

              return (
                <div
                  key={log._id}
                  className="flex items-center justify-between p-4 hover:bg-app-hover transition-colors"
                >
                  {/* Left Peer Avatar & Info */}
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    {peer.avatar ? (
                      <img
                        src={peer.avatar}
                        alt={peer.username}
                        className="w-11 h-11 rounded-full object-cover border border-app-border"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-brand/10 dark:bg-brand/25 flex items-center justify-center text-brand dark:text-white font-bold text-sm border border-app-border/40">
                        {peer.username?.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-app-text-primary truncate">
                          {peer.username}
                        </span>
                      </div>
                      
                      {/* Call status, timestamp, duration */}
                      <div className="flex items-center gap-2 text-xs text-app-text-secondary">
                        {/* Status Icon */}
                        {log.status === "missed" ? (
                          <PhoneMissed size={13} className="text-red-500 shrink-0" />
                        ) : isOutgoing ? (
                          <PhoneOutgoing size={13} className="text-brand shrink-0" />
                        ) : (
                          <PhoneIncoming size={13} className="text-brand shrink-0" />
                        )}

                        <span className="truncate">
                          {formatTimestamp(log.timestamp)}
                        </span>
                        
                        <span className="text-[10px] bg-app-border px-1.5 py-0.5 rounded text-app-text-secondary font-mono shrink-0">
                          {log.status === "missed"
                            ? "Missed"
                            : log.status === "rejected"
                            ? "Rejected"
                            : formatDuration(log.duration)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick callback actions */}
                  <div className="flex items-center gap-2 ml-4">
                    {log.type === "video" ? (
                      <button
                        onClick={() => initiateCall(peer, "video")}
                        className="p-2 hover:bg-app-border text-app-text-secondary hover:text-brand rounded-full transition cursor-pointer"
                        title={`Call ${peer.username} via Video`}
                      >
                        <Video size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={() => initiateCall(peer, "voice")}
                        className="p-2 hover:bg-app-border text-app-text-secondary hover:text-brand rounded-full transition cursor-pointer"
                        title={`Call ${peer.username} via Voice`}
                      >
                        <Phone size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default CallsDrawer;
