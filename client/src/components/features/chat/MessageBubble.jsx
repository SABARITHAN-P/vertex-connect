import { Check, CheckCheck, FileText, Download, Smile, X, Reply, Pin, Edit3, Trash2, ShieldAlert, Forward, Vote, Info } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import EmojiPicker from "emoji-picker-react";
import api from "@services/api";
import { useEscapeKey } from "@hooks/useEscapeKey";
import CustomAudioPlayer from "@components/common/CustomAudioPlayer";
import MessageInfoModal from "@components/features/chat/MessageInfoModal";



function MessageBubble({ own, message, isGroup, onReply, onViewMedia, onEdit, onPin, onDelete, onJumpToMessage, chatRoles = [], uploadQueue = {}, isPinned = false }) {
  const [showPicker, setShowPicker] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showReactionTrigger, setShowReactionTrigger] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editVal, setEditVal] = useState(message.content);
  const [isDoubleTapped, setIsDoubleTapped] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showVotesModal, setShowVotesModal] = useState(false);
  const [now] = useState(() => Date.now());

  // Centralized ESC handling in MessageBubble
  useEscapeKey(() => setIsEditing(false), isEditing, 25);
  useEscapeKey(() => setShowActionsMenu(false), showActionsMenu, 25);
  useEscapeKey(() => setShowPicker(false), showPicker, 25);
  useEscapeKey(() => setShowVotesModal(false), showVotesModal, 25);

  const pickerRef = useRef(null);
  const reactionsRef = useRef(null);
  const actionsMenuRef = useRef(null);
  const lastTap = useRef(0);
  const touchStartPos = useRef({ x: 0, y: 0 });

  const quickReactions = ["❤️", "😂", "😮", "😢", "👍"];

  const currentUser = JSON.parse(localStorage.getItem("userInfo"));

  const {
    _id,
    content,
    caption,
    createdAt,
    messageType,
    media = [],
    replyTo,
    isForwarded,
    poll,
    isDeleted,
    edited,
    /* LEGACY */
    mediaUrl,
    messageStatus,
    reactions,
    sender,
  } = message;

  const isTextMessage = messageType === "text";
  const isPoll = messageType === "poll";
  const isSticker = false;
  const isWithinTwoHours = now - new Date(createdAt).getTime() < 2 * 60 * 60 * 1000;
  const isViewed = messageStatus?.some(s => s.read) || false;
  const editTimeLimit = isViewed ? (10 * 60 * 1000) : (2 * 60 * 60 * 1000);
  const canEditMessage = now - new Date(createdAt).getTime() < editTimeLimit;

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowPicker(false);
      }
      if (reactionsRef.current && !reactionsRef.current.contains(event.target)) {
        setShowReactions(false);
      }
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target)) {
        setShowActionsMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  if (message.isSystem) {
    return (
      <div className="flex justify-center items-center my-2.5 w-full select-none animate-fade-in">
        <div className="bg-app-header/80 border border-app-border/60 px-4 py-1.5 rounded-2xl shadow-sm max-w-[85%] text-center text-[11px] text-app-text-secondary font-semibold tracking-wide flex items-center gap-1.5">
          <ShieldAlert size={13} className="text-brand shrink-0" />
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  let isMessageRead = false;
  let isMessageDelivered = false;

  if (isGroup) {
    const otherParticipants = chatRoles
      .filter((r) => r.role !== "left")
      .map((r) => (r.user?._id || r.user)?.toString())
      .filter((id) => id && id !== currentUser.id);

    if (otherParticipants.length > 0) {
      const otherStatuses = otherParticipants.map((userId) => {
        return messageStatus?.find((s) => (s.user?._id || s.user)?.toString() === userId) || { delivered: false, read: false };
      });
      isMessageRead = otherStatuses.every((s) => s.read);
      isMessageDelivered = otherStatuses.every((s) => s.delivered);
    } else {
      isMessageRead = true;
      isMessageDelivered = true;
    }
  } else {
    const status = messageStatus?.[0];
    isMessageDelivered = status?.delivered || false;
    isMessageRead = status?.read || false;
  }

  const time = new Date(createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const handleReaction = async (emoji) => {
    try {
      await api.put(`/message/react/${_id}`, { emoji });
      setShowPicker(false);
      setShowReactions(false);
    } catch (error) {
      console.log(error);
    }
  };

  const handleDoubleClick = (e) => {
    if (isDeleted) return;
    if (
      e.target.closest("button") ||
      e.target.closest("a") ||
      e.target.closest("input") ||
      e.target.closest("textarea") ||
      e.target.closest(".reactions-ref") ||
      e.target.closest(".emoji-picker-react") ||
      e.target.closest(".audio-player-controls")
    ) return;
    e.preventDefault();
    setIsDoubleTapped(true);
    setTimeout(() => setIsDoubleTapped(false), 500);
    onReply(message);
  };

  const handleTouchStart = (e) => {
    if (isDeleted) return;
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e) => {
    if (isDeleted) return;
    if (
      e.target.closest("button") ||
      e.target.closest("a") ||
      e.target.closest("input") ||
      e.target.closest("textarea") ||
      e.target.closest(".reactions-ref") ||
      e.target.closest(".emoji-picker-react") ||
      e.target.closest(".audio-player-controls")
    ) return;
    const touch = e.changedTouches[0];
    const diffX = Math.abs(touch.clientX - touchStartPos.current.x);
    const diffY = Math.abs(touch.clientY - touchStartPos.current.y);

    if (diffX > 10 || diffY > 10) return; // scroll prevent

    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (now - lastTap.current < DOUBLE_PRESS_DELAY) {
      e.preventDefault();
      setIsDoubleTapped(true);
      setTimeout(() => setIsDoubleTapped(false), 500);
      onReply(message);
    }
    lastTap.current = now;
  };

  const handlePollVote = async (optionText) => {
    try {
      await api.put(`/message/poll/vote/${_id}`, { optionText });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveEdit = async () => {
    if (!editVal.trim()) return;
    try {
      await api.put(`/message/edit/${_id}`, { content: editVal });
      setIsEditing(false);
      if (onEdit) onEdit(_id, editVal);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMessage = async (deleteType) => {
    try {
      await api.delete(`/message/${_id}`, { data: { deleteType } });
      setShowActionsMenu(false);
      if (onDelete) onDelete(_id, deleteType);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTogglePin = async () => {
    try {
      setShowActionsMenu(false);
      if (onPin) {
        await onPin(_id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const uploadState = uploadQueue?.[_id];
  const isFailed = uploadState?.status === "failed";
  const progress = uploadState?.progress || 0;

  const totalPollVotes = poll?.options?.reduce((acc, opt) => acc + (opt.votes?.length || 0), 0) || 0;

  const userRole = chatRoles.find((r) => r.user?._id === currentUser.id)?.role || "member";
  const canAdminMessageActions = ["owner", "admin", "moderator"].includes(userRole);

  const renderFooter = () => (
    <div className="flex items-center justify-end gap-[4px] mt-1 select-none">
      {isPinned && <Pin size={10} className={`${own ? "text-app-bubble-outgoing-text/60" : "text-app-text-secondary/60"} shrink-0 transform rotate-45 mr-0.5`} />}
      {edited && <span className={`text-[10px] ${own ? "text-app-bubble-outgoing-text/60" : "text-app-text-secondary/60"} italic mr-1`}>edited</span>}
      <span className={`text-[11px] ${own ? "text-app-bubble-outgoing-text/80" : "text-app-text-secondary/80"}`}>{time}</span>
      {own &&
        (isMessageRead ? (
          <CheckCheck size={14} className="text-app-read-receipt" />
        ) : isMessageDelivered ? (
          <CheckCheck size={14} className="text-app-bubble-outgoing-text/80" />
        ) : (
          <Check size={14} className="text-app-bubble-outgoing-text/60" />
        ))}
    </div>
  );


  return (
    <div
      onMouseEnter={() => setShowReactionTrigger(true)}
      onMouseLeave={() => {
        setShowReactionTrigger(false);
        setShowActionsMenu(false);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
      }}
      onDoubleClickCapture={handleDoubleClick}
      onTouchStartCapture={handleTouchStart}
      onTouchEndCapture={handleTouchEnd}
      title="Double click or double tap to reply"
      className={`flex items-end mb-2.5 ${own ? "justify-end" : "justify-start"} cursor-pointer select-none`}
    >
      <div className="relative flex flex-col max-w-[80%]">
        {/* REPLY PREVIEW LINK */}
        {replyTo?.messageId && (
          <div
            onClick={() => onJumpToMessage(replyTo.messageId)}
            className="cursor-pointer mb-1 bg-app-input hover:bg-app-hover border-l-[3px] border-brand rounded p-2 text-xs text-app-text-secondary flex items-center justify-between gap-3 max-w-sm transition"
          >
            <div className="min-w-0 flex-1">
              <span className="text-brand font-bold block text-[10px] uppercase tracking-wider">
                Reply to {replyTo.senderName || replyTo.sender?.username || "User"}
              </span>
              <span className="truncate block mt-0.5 max-w-full text-xs text-app-text-primary">
                {replyTo.text || "Media Attachment"}
              </span>
            </div>
          </div>
        )}

        {/* FORWARDED TAG */}
        {isForwarded && (
          <div className="flex items-center gap-1.5 text-app-text-secondary text-[10px] mb-1 italic">
            <Forward size={10} /> Forwarded
          </div>
        )}

        <div className={`relative flex items-center w-full ${own ? "justify-end" : "justify-start"}`}>
          {/* QUICK REACTIONS */}
          {showReactions && !isDeleted && (
            <div
              ref={reactionsRef}
              className={`absolute -top-12 z-50 bg-app-header rounded-full px-2.5 py-1.5 flex items-center gap-2.5 shadow-xl border border-app-border ${own ? "right-0" : "left-0"
                }`}
            >
              {quickReactions.map((emoji) => (
                <button key={emoji} onClick={() => handleReaction(emoji)} className="text-lg hover:scale-125 transition">
                  {emoji}
                </button>
              ))}
              <button
                onClick={() => setShowPicker(!showPicker)}
                className="w-7 h-7 rounded-full bg-app-hover text-app-text-primary flex items-center justify-center hover:bg-app-input transition font-bold"
              >
                +
              </button>
            </div>
          )}

          {/* PICKER */}
          {showPicker && !isDeleted && (
            <div ref={pickerRef} className={`fixed z-[9999] bottom-24 ${own ? "right-24" : "left-24"}`}>
              <div className="rounded-2xl overflow-hidden shadow-2xl border border-app-border bg-app-modal">
                <EmojiPicker
                  onEmojiClick={(emojiData) => handleReaction(emojiData.emoji)}
                  theme="dark"
                  width={300}
                  height={350}
                  previewConfig={{ showPreview: false }}
                />
              </div>
            </div>
          )}

          {/* ACTIONS TRIGGER & MENU */}
          {showReactionTrigger && !isDeleted && (
            <div
              className={`absolute top-1/2 -translate-y-1/2 z-40 flex items-center gap-1 transition-all duration-300 animate-fade-in ${own ? "right-full mr-2" : "left-full ml-2"
                }`}
            >
              <button
                onClick={() => setShowReactions(true)}
                className="w-6 h-6 rounded-full bg-app-header border border-app-border flex items-center justify-center hover:bg-app-hover transition"
              >
                <Smile size={13} className="text-app-text-secondary" />
              </button>
              <button
                onClick={() => setShowActionsMenu(!showActionsMenu)}
                className="w-6 h-6 rounded-full bg-app-header border border-app-border flex items-center justify-center hover:bg-app-hover text-app-text-secondary font-bold text-xs"
              >
                ⋮
              </button>

              {showActionsMenu && (
                <div
                  ref={actionsMenuRef}
                  className={`absolute bottom-8 z-50 bg-app-header border border-app-border rounded-lg shadow-xl w-36 py-1 text-xs text-app-text-primary ${own ? "right-0" : "left-0"
                    }`}
                >
                  <button
                    onClick={() => {
                      onReply(message);
                      setShowActionsMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-app-hover flex items-center gap-2 transition"
                  >
                    <Reply size={13} /> Reply
                  </button>
                  {own && !edited && canEditMessage && (
                    <button
                      onClick={() => {
                        setIsEditing(true);
                        setShowActionsMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-app-hover flex items-center gap-2 transition"
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                  )}
                  <button
                    onClick={handleTogglePin}
                    className="w-full text-left px-3 py-2 hover:bg-app-hover flex items-center gap-2 transition"
                  >
                    <Pin size={13} /> {isPinned ? "Unpin Message" : "Pin Message"}
                  </button>
                  {own && (
                    <button
                      onClick={() => {
                        setShowInfoModal(true);
                        setShowActionsMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-app-hover flex items-center gap-2 transition"
                    >
                      <Info size={13} /> Info
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteMessage("forMe")}
                    className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-400 flex items-center gap-2 transition"
                  >
                    <Trash2 size={13} /> Delete for me
                  </button>
                  {(own || canAdminMessageActions) && isWithinTwoHours && (
                    <button
                      onClick={() => handleDeleteMessage("forEveryone")}
                      className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-500 flex items-center gap-2 transition border-t border-app-border/40"
                    >
                      <ShieldAlert size={13} /> Delete everyone
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* MESSAGE CARDS / BUBBLES */}
          <div
            className={`relative overflow-hidden select-none transition-all duration-300 transform active:scale-98 ${isDoubleTapped
                ? "scale-95 border-2 border-brand shadow-[0_0_15px_rgba(79,70,229,0.45)] ring-4 ring-brand/20 brightness-110"
                : "hover:brightness-105"
              } ${isSticker
                ? "bg-transparent text-app-text-primary"
                : own ? "message-bubble-padding bg-app-bubble-outgoing text-app-bubble-outgoing-text rounded-xl px-3 py-2 shadow-sm min-w-[120px]" : "message-bubble-padding bg-app-bubble-incoming text-app-text-primary rounded-xl px-3 py-2 shadow-sm min-w-[120px]"
              }`}
          >
            {/* OPTIMISTIC UPLOAD OVERLAY */}
            {(message.optimistic || uploadState) && (
              <div className="absolute inset-0 z-20 backdrop-blur-sm bg-black/45 flex flex-col items-center justify-center gap-2 p-3 transition-all duration-300">
                {isFailed ? (
                  <div className="text-center space-y-1.5 animate-fade-in">
                    <ShieldAlert className="text-red-500 mx-auto" size={24} />
                    <span className="text-[10px] text-red-400 font-medium block">Upload failed</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (uploadState?.retryFn) uploadState.retryFn();
                      }}
                      className="bg-brand text-white text-[10px] px-3 py-1 rounded-full font-semibold hover:bg-brand/90 transition"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <div className="text-center space-y-2 w-full max-w-[80%] flex flex-col items-center animate-pulse">
                    {/* Spinning ring progress indicator */}
                    <div className="relative w-10 h-10 flex items-center justify-center">
                      <svg className="w-10 h-10 transform -rotate-90">
                        <circle
                          cx="20"
                          cy="20"
                          r="16"
                          stroke="var(--bg-input)"
                          strokeWidth="3.5"
                          fill="transparent"
                        />
                        <circle
                          cx="20"
                          cy="20"
                          r="16"
                          stroke="var(--color-brand)"
                          strokeWidth="3.5"
                          fill="transparent"
                          strokeDasharray={100}
                          strokeDashoffset={100 - (progress || 10)}
                          className="transition-all duration-300"
                        />
                      </svg>
                      <span className="absolute text-[9px] font-bold text-white">{progress || 0}%</span>
                    </div>
                    <span className="text-[10px] text-gray-300 font-medium">Uploading attachment...</span>
                  </div>
                )}
              </div>
            )}
            {/* GROUP CHAT SENDER NAME LABEL */}
            {isGroup && !own && sender && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent("view-user-profile", { detail: sender }));
                }}
                className="block text-[11px] font-bold text-brand mb-1 tracking-wide cursor-pointer hover:underline"
              >
                {sender.username}
              </span>
            )}

            {/* DELETED MESSAGE FALLBACK */}
            {isDeleted ? (
              <p className="text-gray-400 text-xs italic flex items-center gap-1.5 py-1">
                <Trash2 size={13} /> This message was deleted
              </p>
            ) : isEditing ? (
              <div className="space-y-1.5 py-1 min-w-[200px]">
                <input
                  type="text"
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSaveEdit();
                    } else if (e.key === "Escape") {
                      setIsEditing(false);
                    }
                  }}
                  className="w-full bg-app-input rounded px-2.5 py-1.5 text-xs text-app-text-primary border border-brand outline-none"
                />
                <div className="flex justify-end gap-1.5">
                  <button onClick={() => setIsEditing(false)} className="text-[10px] text-app-text-secondary hover:text-app-text-primary px-2 py-1">
                    Cancel
                  </button>
                  <button onClick={handleSaveEdit} className="text-[10px] bg-brand text-white px-2.5 py-1 rounded hover:bg-brand/90 transition-colors">
                    Save
                  </button>
                </div>
              </div>
            ) : isPoll ? (
              /* POLL CARD VIEW */
              <div className="space-y-3 py-1.5 min-w-[240px]">
                <h4 className="text-xs font-bold text-app-text-primary tracking-wide flex items-center gap-1.5">
                  <Vote size={14} className="text-brand" /> {poll.question}
                </h4>
                <div className="space-y-2">
                  {poll.options?.map((opt, i) => {
                    const votesCount = opt.votes?.length || 0;
                    const percent = totalPollVotes > 0 ? (votesCount / totalPollVotes) * 100 : 0;
                    const hasVoted = opt.votes?.some((v) => (v._id || v) === currentUser.id);

                    return (
                      <div
                        key={i}
                        onClick={() => handlePollVote(opt.optionText)}
                        className={`group relative overflow-hidden rounded-lg p-2.5 cursor-pointer border transition ${hasVoted ? "bg-brand/15 border-brand/35" : "bg-app-input border-app-border hover:bg-app-hover"
                          }`}
                      >
                        {/* Vote progress backdrop */}
                        <div
                          className="absolute inset-y-0 left-0 bg-brand/10 transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />

                        <div className="relative flex justify-between items-center text-xs z-10">
                          <span className="font-medium text-app-text-primary">{opt.optionText}</span>
                          <span className="text-app-text-secondary font-bold">{votesCount} votes</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between items-center text-[9px] text-app-text-secondary font-semibold tracking-wider uppercase select-none border-b border-app-border pb-2">
                  <span>{poll.showVoters === false ? "🔒 Secret Poll" : "👥 Public Poll"}</span>
                  <span>{totalPollVotes} total votes</span>
                </div>

                {poll.showVoters !== false && (
                  <button
                    type="button"
                    onClick={() => setShowVotesModal(true)}
                    className="w-full py-2 mt-1 text-center text-xs font-bold text-brand hover:text-brand/90 bg-brand/10 hover:bg-brand/15 border border-brand/20 hover:border-brand/40 rounded-lg transition cursor-pointer"
                  >
                    View Votes
                  </button>
                )}
              </div>
            ) : isTextMessage ? (
              <p className="break-words whitespace-pre-wrap text-[14px] leading-5">{content}</p>
            ) : (
              /* MEDIA GRIDS */
              <div className="space-y-2">
                {media.length === 0 && mediaUrl ? (
                  <div className="relative cursor-pointer max-w-[280px] min-h-[160px] md:min-h-[200px] w-full bg-[#2a3942]/30 rounded-lg overflow-hidden" onClick={() => onViewMedia?.({ url: mediaUrl, type: "image", senderName: sender?.username || "User", time })}>
                    <img src={mediaUrl} alt="shared" className="w-full h-full object-cover rounded-lg" />
                  </div>
                ) : (
                  <div className="grid gap-1.5 max-w-[280px]">
                    {media.map((item, index) => {

                      if (item.type === "image") {
                        return (
                          <div key={index} className="overflow-hidden rounded-lg min-h-[160px] md:min-h-[200px] w-full bg-[#2a3942]/30" onClick={() => onViewMedia?.({ ...item, senderName: sender?.username || "User", time })}>
                            <img src={item.url} alt="media" className="w-full h-full object-cover cursor-pointer hover:scale-102 transition" />
                          </div>
                        );
                      }
                      if (item.type === "video") {
                        return (
                          <div key={index} className="overflow-hidden rounded-lg bg-black min-h-[160px] md:min-h-[200px] w-full bg-[#2a3942]/30 flex items-center justify-center" onClick={(e) => { e.preventDefault(); onViewMedia?.({ ...item, senderName: sender?.username || "User", time }); }}>
                            <video src={item.url} controls className="w-full h-full object-cover" />
                          </div>
                        );
                      }

                      if (item.type === "audio") {
                        const isVoice = item.fileName?.startsWith("voice-message");
                        return (
                          <div key={index} className={`rounded-lg ${isVoice ? "p-1" : "bg-black/20 p-2.5"}`}>
                            {!isVoice && <p className="text-xs mb-1.5 truncate font-medium">{item.fileName}</p>}
                            <CustomAudioPlayer src={item.url} isVoiceMessage={isVoice} messageId={_id} own={own} isPlayed={isMessageRead} peaks={item.peaks} />
                          </div>
                        );
                      }
                      return (
                        <a key={index} href={item.url} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 bg-black/20 p-2.5 rounded-lg hover:bg-black/30 transition">
                          <FileText size={24} className="shrink-0 text-gray-300" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs truncate font-medium">{item.fileName}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{formatFileSize(item.fileSize)}</p>
                          </div>
                          <Download size={14} className="shrink-0 text-gray-400" />
                        </a>
                      );
                    })}
                  </div>
                )}
                {caption && <p className="text-xs px-0.5 pt-1 break-words">{caption}</p>}
              </div>
            )}

            {renderFooter()}
          </div>
        </div>

        {/* REACTIONS PANEL DISPLAY */}
        {reactions?.length > 0 && (
          <div className={`flex gap-1 mt-1 ${own ? "justify-end" : "justify-start"}`}>
            {[...new Set(reactions.map((r) => r.emoji))].map((emoji) => {
              const count = reactions.filter((r) => r.emoji === emoji).length;
              return (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className="bg-app-input border border-app-border px-2 py-[2px] rounded-full text-[10px] flex items-center gap-1 hover:bg-app-hover transition cursor-pointer"
                >
                  <span>{emoji}</span>
                  <span className="text-app-text-secondary font-bold">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <MessageInfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        messageId={_id}
        isGroup={isGroup}
        chatParticipants={chatRoles.map((r) => r.user)}
      />

      {showVotesModal && isPoll && (
        <ViewVotesModal
          question={poll.question}
          options={poll.options}
          onClose={() => setShowVotesModal(false)}
        />
      )}
    </div>
  );
}

function ViewVotesModal({ question, options, onClose }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-app-modal text-app-text-primary w-full max-w-md rounded-2xl border border-app-border shadow-2xl flex flex-col max-h-[80vh] overflow-hidden animate-slide-up">
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-app-border flex justify-between items-center bg-app-header">
          <h2 className="text-base font-semibold tracking-wide flex items-center gap-2 text-brand">
            <Vote size={18} /> Poll Results
          </h2>
          <button type="button" onClick={onClose} className="text-app-text-secondary hover:text-app-text-primary p-1.5 hover:bg-app-hover rounded-lg transition cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-5 flex-1 overflow-y-auto space-y-5">
          <div className="bg-app-input border border-app-border rounded-xl p-4">
            <span className="text-[10px] text-app-text-secondary uppercase font-bold tracking-wider block mb-1 select-none">Question</span>
            <h3 className="text-sm font-semibold text-app-text-primary leading-relaxed">{question}</h3>
          </div>

          <div className="space-y-4">
            {options.map((opt, optIdx) => {
              const votesCount = opt.votes?.length || 0;
              return (
                <div key={optIdx} className="space-y-3 bg-app-sidebar border border-app-border rounded-xl p-3.5">
                  <div className="flex justify-between items-center border-b border-app-border/60 pb-2">
                    <span className="text-xs font-bold text-app-text-primary">{opt.optionText}</span>
                    <span className="text-[10px] font-bold bg-brand/20 text-brand px-2.5 py-0.5 rounded-full shrink-0">
                      {votesCount} {votesCount === 1 ? "vote" : "votes"}
                    </span>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    {votesCount === 0 ? (
                      <div className="text-[10px] text-app-text-secondary italic py-1 pl-1 select-none">No votes for this option yet</div>
                    ) : (
                      opt.votes.map((voter, voterIdx) => {
                        const voterUser = voter._id ? voter : { _id: voter, username: "User", avatar: "" };
                        return (
                          <div key={voterUser._id || voterIdx} className="flex items-center gap-2.5 py-1">
                            {voterUser.avatar ? (
                              <img
                                src={voterUser.avatar}
                                alt={voterUser.username}
                                className="h-6 w-6 rounded-full object-cover ring-1 ring-white/10 shrink-0"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-brand text-white flex items-center justify-center text-xs font-bold shrink-0">
                                {voterUser.username ? voterUser.username[0].toUpperCase() : "U"}
                              </div>
                            )}
                            <span className="text-xs font-medium text-app-text-primary">{voterUser.username}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-5 py-4 border-t border-app-border flex justify-end bg-app-header">
          <button
            type="button"
            onClick={onClose}
            className="bg-brand hover:bg-brand/90 text-white px-5 py-2 text-xs font-semibold rounded-lg transition shadow-md cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default MessageBubble;
