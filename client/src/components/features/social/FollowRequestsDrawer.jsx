import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Check, X, Users } from "lucide-react";
import api from "@services/api";
import { useEscapeKey } from "@hooks/useEscapeKey";
import toast from "react-hot-toast";

function FollowRequestsDrawer({ onClose, onRequestCountChange }) {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/user/follow/requests");
      setRequests(data);
      if (onRequestCountChange) {
        onRequestCountChange(data.length);
      }
    } catch (error) {
      console.error("Failed to fetch follow requests:", error);
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, [onRequestCountChange]);

  // Close drawer on Escape (Priority: 7)
  useEscapeKey(onClose, true, 7);

  useEffect(() => {
    let active = true;
    const handle = requestAnimationFrame(() => {
      if (active) fetchRequests();
    });
    return () => {
      active = false;
      cancelAnimationFrame(handle);
    };
  }, [fetchRequests]);

  const handleAccept = async (requestId, username) => {
    try {
      await api.post(`/user/follow/request/${requestId}/accept`);
      toast.success(`Follow request accepted from ${username}!`);
      const updated = requests.filter((r) => r.requestId !== requestId);
      setRequests(updated);
      if (onRequestCountChange) {
        onRequestCountChange(updated.length);
      }
    } catch (error) {
      console.error("Failed to accept follow request:", error);
      toast.error("Failed to accept request");
    }
  };

  const handleReject = async (requestId, username) => {
    try {
      await api.post(`/user/follow/request/${requestId}/reject`);
      toast.success(`Declined follow request from ${username}`);
      const updated = requests.filter((r) => r.requestId !== requestId);
      setRequests(updated);
      if (onRequestCountChange) {
        onRequestCountChange(updated.length);
      }
    } catch (error) {
      console.error("Failed to reject follow request:", error);
      toast.error("Failed to decline request");
    }
  };

  if (loading) {
    return (
      <div className="absolute inset-0 bg-app-drawer text-app-text-primary z-50 flex flex-col justify-center items-center select-none">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-app-drawer text-app-text-primary z-50 flex flex-col transition-transform duration-300 transform translate-x-0 select-none animate-fade-in">
      {/* HEADER */}
      <div className="h-[60px] bg-app-header flex items-center p-4 gap-4 border-b border-app-border shrink-0">
        <button
          onClick={onClose}
          className="p-1.5 text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover rounded-full transition"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="text-app-text-primary font-semibold text-lg">Follow Requests</span>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-4">
            <div className="p-4 bg-brand/10 rounded-full text-brand animate-pulse">
              <Users size={32} />
            </div>
            <div>
              <h3 className="text-app-text-primary font-semibold text-base">No pending requests</h3>
              <p className="text-app-text-secondary text-xs mt-1 leading-relaxed">
                When private account follow requests are received, they will appear here. You're all caught up!
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div
                key={req.requestId}
                className="bg-app-header border border-app-border rounded-2xl p-4 flex items-center justify-between hover:bg-app-hover transition duration-200"
              >
                {/* Profile Card Info */}
                <div className="flex items-center gap-3 min-w-0">
                  {req.user.avatar ? (
                    <img
                      src={req.user.avatar}
                      alt={req.user.username}
                      className="w-11 h-11 rounded-full object-cover border border-app-border shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-brand/10 dark:bg-brand/25 border border-brand/30 flex items-center justify-center text-sm font-bold text-brand dark:text-white uppercase shrink-0">
                      {req.user.username[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="text-app-text-primary font-semibold text-sm truncate">
                      {req.user.username}
                    </h4>
                    <p className="text-app-text-secondary text-xs truncate mt-0.5 max-w-[180px]">
                      {req.user.about || "Hey there! I am using Vertex Connect."}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleAccept(req.requestId, req.user.username)}
                    className="w-8 h-8 rounded-full bg-brand/15 border border-brand/40 hover:bg-brand hover:border-transparent text-brand hover:text-white flex items-center justify-center transition duration-200"
                    title="Accept Follow Request"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => handleReject(req.requestId, req.user.username)}
                    className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/30 hover:bg-red-500 hover:border-transparent text-red-500 hover:text-white flex items-center justify-center transition duration-200"
                    title="Ignore Request"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default FollowRequestsDrawer;
