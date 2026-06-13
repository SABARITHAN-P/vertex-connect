import { X, CheckCheck, Info } from "lucide-react";
import { useEffect, useState } from "react";
import api from "@services/api";
import { socket } from "@socket/socket";
import { useEscapeKey } from "@hooks/useEscapeKey";

function MessageInfoModal({ isOpen, onClose, messageId, isGroup, chatParticipants = [] }) {
  // Close modal on ESC key
  useEscapeKey(onClose, isOpen, 10);

  const [messageInfo, setMessageInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !messageId) return;

    const fetchInfo = async () => {
      try {
        setLoading(true);
        setError("");
        const { data } = await api.get(`/message/info/${messageId}`);
        setMessageInfo(data);
      } catch (err) {
        console.error("Failed to load message info:", err);
        setError("Failed to load message details");
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
  }, [isOpen, messageId]);

  useEffect(() => {
    if (!isOpen || !messageId) return;

    const handleStatusUpdate = (data) => {
      if (data._id === messageId) {
        setMessageInfo((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            messageStatus: data.messageStatus,
          };
        });
      }
    };

    socket.on("messageStatusUpdated", handleStatusUpdate);

    return () => {
      socket.off("messageStatusUpdated", handleStatusUpdate);
    };
  }, [isOpen, messageId]);

  if (!isOpen) return null;

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const renderMessagePreview = () => {
    if (!messageInfo) return null;
    const { content, messageType } = messageInfo;

    return (
      <div className="bg-app-input border border-app-border rounded-xl p-3 mb-4 flex flex-col gap-1.5 shadow-inner">
        <p className="text-[10px] text-app-text-secondary font-bold uppercase tracking-wider">Message Preview</p>
        {messageType === "text" ? (
          <p className="text-app-text-primary text-xs leading-relaxed break-words">{content}</p>
        ) : (
          <div className="flex items-center gap-2 text-xs text-app-text-secondary">
            <span className="text-base">📎</span>
            <span className="capitalize">{messageType} Attachment</span>
          </div>
        )}
      </div>
    );
  };

  // Group Details Calculation
  const getGroupStats = () => {
    if (!messageInfo || !isGroup) return null;

    const statusArray = messageInfo.messageStatus || [];

    // Filter out the sender from the total list of participants who should receive/read
    const senderId = (messageInfo.sender?._id || messageInfo.sender)?.toString();
    const senderUsername = messageInfo.sender?.username;

    const targetParticipants = chatParticipants.filter((p) => {
      const pId = (p?._id || p)?.toString();
      const pUsername = p?.username;
      const isSender = (pId && pId === senderId) || (pUsername && pUsername === senderUsername);
      return !isSender;
    });

    const readList = [];
    const deliveredList = [];

    // Map existing statuses to read/delivered categories
    statusArray.forEach((status) => {
      const statusUserId = (status.user?._id || status.user)?.toString();
      const statusUsername = status.user?.username;
      const isSender = (statusUserId && statusUserId === senderId) || (statusUsername && statusUsername === senderUsername);
      if (isSender) return;

      if (status.read) {
        readList.push(status);
        deliveredList.push(status); // also delivered! "so if user see also dont change the delivered"
      } else if (status.delivered) {
        deliveredList.push(status);
      }
    });

    // Calculate remaining counts
    const remainingToDeliver = targetParticipants.length - deliveredList.length;
    const remainingToRead = targetParticipants.length - readList.length;

    return {
      readList,
      deliveredList,
      remainingToDeliver: Math.max(0, remainingToDeliver),
      remainingToRead: Math.max(0, remainingToRead),
      totalParticipantsCount: targetParticipants.length,
    };
  };

  const stats = getGroupStats();

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-app-modal border border-app-border rounded-2xl w-full max-w-md p-5 flex flex-col max-h-[85vh] shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between pb-3.5 border-b border-app-border">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-brand" />
            <h2 className="text-app-text-primary text-sm font-bold uppercase tracking-wider">Message Info</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-app-text-secondary hover:text-app-text-primary p-1 hover:bg-app-hover rounded-full transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto py-4 min-h-0 custom-scrollbar pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-brand animate-spin" />
              <p className="text-xs text-app-text-secondary">Loading details...</p>
            </div>
          ) : error ? (
            <div className="text-center text-xs text-red-400 py-10 leading-relaxed">
              {error}
            </div>
          ) : (
            <>
              {renderMessagePreview()}

              {/* DM VIEW */}
              {!isGroup && messageInfo && (
                <div className="space-y-4">
                  {/* Delivered Row */}
                  <div className="bg-app-input/40 border border-app-border rounded-xl p-3.5 flex items-start gap-3.5 shadow-sm">
                    <div className="w-8 h-8 rounded-full bg-app-hover flex items-center justify-center text-app-text-secondary border border-white/5">
                      <CheckCheck size={16} className="text-app-text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-app-text-primary font-bold tracking-wide uppercase">Delivered</p>
                      {messageInfo.messageStatus?.[0]?.deliveredAt ? (
                        <p className="text-[11px] text-app-text-secondary mt-1">
                          {formatDate(messageInfo.messageStatus[0].deliveredAt)} at {formatTime(messageInfo.messageStatus[0].deliveredAt)}
                        </p>
                      ) : (
                        <p className="text-[11px] text-app-text-secondary mt-1 italic">Not delivered yet</p>
                      )}
                    </div>
                  </div>

                  {/* Read Row */}
                  <div className="bg-app-input/40 border border-app-border rounded-xl p-3.5 flex items-start gap-3.5 shadow-sm">
                    <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-brand border border-white/5">
                      <CheckCheck size={16} className="text-[#53bdeb]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-app-text-primary font-bold tracking-wide uppercase">Read</p>
                      {messageInfo.messageStatus?.[0]?.readAt ? (
                        <p className="text-[11px] text-[#53bdeb] font-semibold mt-1">
                          {formatDate(messageInfo.messageStatus[0].readAt)} at {formatTime(messageInfo.messageStatus[0].readAt)}
                        </p>
                      ) : (
                        <p className="text-[11px] text-app-text-secondary mt-1 italic">Not read yet</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* GROUP VIEW */}
              {isGroup && messageInfo && stats && (
                <div className="space-y-5">
                  {/* STATS COUNT BADGES */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-2.5 text-center">
                      <div className="text-amber-400 text-lg font-black">{stats.remainingToDeliver}</div>
                      <div className="text-[9px] text-app-text-secondary uppercase font-extrabold tracking-wide mt-0.5">Remaining to Deliver</div>
                    </div>
                    <div className="bg-[#53bdeb]/5 border border-[#53bdeb]/10 rounded-xl p-2.5 text-center">
                      <div className="text-[#53bdeb] text-lg font-black">{stats.remainingToRead}</div>
                      <div className="text-[9px] text-app-text-secondary uppercase font-extrabold tracking-wide mt-0.5">Remaining to Read</div>
                    </div>
                  </div>

                  {/* READ BY LIST */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1.5 px-1 border-b border-app-border/40 pb-1.5">
                      <CheckCheck size={14} className="text-[#53bdeb]" />
                      <h3 className="text-xs text-[#53bdeb] font-black uppercase tracking-wider">Read By ({stats.readList.length})</h3>
                    </div>
                    {stats.readList.length === 0 ? (
                      <p className="text-[10px] text-app-text-secondary italic px-1">No one has read this message yet</p>
                    ) : (
                      <div className="space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar">
                        {stats.readList.map((status) => (
                          <div key={status.user?._id} className="flex items-center justify-between p-2 rounded-lg bg-app-input/30 border border-app-border/60">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center bg-brand/10 dark:bg-brand/25 text-brand dark:text-white border border-app-border/40">
                                {status.user?.avatar ? (
                                  <img src={status.user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[10px] uppercase font-bold">{status.user?.username?.[0]}</span>
                                )}
                              </div>
                              <span className="text-xs text-app-text-primary font-medium">{status.user?.username}</span>
                            </div>
                            <span className="text-[10px] text-[#53bdeb] font-semibold">{formatDate(status.readAt)} {formatTime(status.readAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* DELIVERED TO LIST */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1.5 px-1 border-b border-app-border/40 pb-1.5 pt-2">
                      <CheckCheck size={14} className="text-app-text-secondary" />
                      <h3 className="text-xs text-app-text-primary font-black uppercase tracking-wider">Delivered To ({stats.deliveredList.length})</h3>
                    </div>
                    {stats.deliveredList.length === 0 ? (
                      <p className="text-[10px] text-app-text-secondary italic px-1">No pending delivered recipients</p>
                    ) : (
                      <div className="space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar">
                        {stats.deliveredList.map((status) => (
                          <div key={status.user?._id} className="flex items-center justify-between p-2 rounded-lg bg-app-input/30 border border-app-border/60">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center bg-brand/10 dark:bg-brand/25 text-brand dark:text-white border border-app-border/40">
                                {status.user?.avatar ? (
                                  <img src={status.user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[10px] uppercase font-bold">{status.user?.username?.[0]}</span>
                                )}
                              </div>
                              <span className="text-xs text-app-text-primary font-medium">{status.user?.username}</span>
                            </div>
                            <span className="text-[10px] text-app-text-secondary font-semibold">{formatDate(status.deliveredAt)} {formatTime(status.deliveredAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default MessageInfoModal;
