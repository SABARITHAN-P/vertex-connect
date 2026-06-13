/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, useCallback } from "react";
import { X, Mail, Users, Info, ArrowLeft, Shield, Copy, Ban } from "lucide-react";
import { formatLastSeen } from "@utils/dateFormatter";
import { useEscapeKey } from "@hooks/useEscapeKey";
import axios from "axios";
import toast from "react-hot-toast";

function UserProfileModal({ isOpen, onClose, user, onlineUsers = [], lastSeenUsers = {}, chats = [], onStartDM }) {
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [followStats, setFollowStats] = useState({
    followersCount: 0,
    followingCount: 0,
    status: "not_following",
  });
  const [followListOpen, setFollowListOpen] = useState(false);
  const [followListType, setFollowListType] = useState("followers"); // "followers" or "following"
  const [followUsers, setFollowUsers] = useState([]);
  const [listLoading, setListLoading] = useState(false);

  const fetchFollowStatus = useCallback(async () => {
    if (!user?._id) return;
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const config = {
        headers: { Authorization: `Bearer ${userInfo.token}` },
      };
      const targetId = user._id || user.id;
      const { data } = await axios.get(`http://localhost:5000/api/user/follow/status/${targetId}`, config);
      setFollowStats(data);
    } catch (error) {
      console.error("Failed to fetch follow status:", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  const handleToggleFollow = async () => {
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const config = {
        headers: { Authorization: `Bearer ${userInfo.token}` },
      };
      const targetId = user._id || user.id;
      await axios.post(`http://localhost:5000/api/user/follow/${targetId}`, {}, config);
      await fetchFollowStatus();
    } catch (error) {
      console.error("Follow toggle failed:", error);
    }
  };

  const handleBlock = async () => {
    if (window.confirm(`Are you sure you want to block ${user.username}?`)) {
      try {
        const userInfo = JSON.parse(localStorage.getItem("userInfo"));
        const config = {
          headers: { Authorization: `Bearer ${userInfo.token}` },
        };
        const targetId = user._id || user.id;
        await axios.post(`http://localhost:5000/api/user/block/${targetId}`, {}, config);
        await fetchFollowStatus();
      } catch (error) {
        console.error("Block failed:", error);
      }
    }
  };

  const handleUnblock = async () => {
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const config = {
        headers: { Authorization: `Bearer ${userInfo.token}` },
      };
      const targetId = user._id || user.id;
      await axios.post(`http://localhost:5000/api/user/unblock/${targetId}`, {}, config);
      await fetchFollowStatus();
    } catch (error) {
      console.error("Unblock failed:", error);
    }
  };

  const openFollowList = async (type) => {
    try {
      setFollowListType(type);
      setFollowListOpen(true);
      setListLoading(true);
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const config = {
        headers: { Authorization: `Bearer ${userInfo.token}` },
      };
      const targetId = user._id || user.id;
      const { data } = await axios.get(`http://localhost:5000/api/user/follow/${type}/${targetId}`, config);
      setFollowUsers(data);
    } catch (error) {
      console.error(`Failed to fetch ${type} list:`, error);
    } finally {
      setListLoading(false);
    }
  };

  // Centralized ESC handling: close sub-pages or overlays first, then the modal itself
  useEscapeKey(() => setFollowListOpen(false), isOpen && followListOpen, 30);
  useEscapeKey(() => setIsImageViewerOpen(false), isOpen && isImageViewerOpen, 20);
  useEscapeKey(onClose, isOpen && !isImageViewerOpen && !followListOpen, 10);

  useEffect(() => {
    if (isOpen && user?._id) {
      fetchFollowStatus();
    }
  }, [isOpen, user?._id, fetchFollowStatus]);

  if (!isOpen || !user) return null;

  const targetId = user._id || user.id;
  const isOnline = onlineUsers?.some(id => id?.toString() === targetId?.toString());
  const lastSeenVal = lastSeenUsers[targetId] || user.lastSeen;

  const userInfo = JSON.parse(localStorage.getItem("userInfo"));
  const isMe = targetId === userInfo?.id || targetId === userInfo?._id;

  // Calculate shared groups count
  const sharedGroups = chats.filter((chat) => 
    chat.isGroupChat && 
    chat.participants?.some((p) => p._id === targetId || p === targetId)
  );

  return (
    <>
      {/* DRAWER BACKDROP */}
      <div 
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />

      {/* DRAWER WRAPPER */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-gradient-to-b from-slate-50 via-white to-slate-50/60 dark:from-zinc-950 dark:via-[#0c0c0f] dark:to-zinc-900 border-l border-app-border text-app-text-primary shadow-2xl flex flex-col animate-slide-in select-none">
        
        {/* DRAWER HEADER BAR */}
        <div className="h-[60px] bg-app-header flex items-center justify-between px-4 border-b border-app-border shrink-0 z-10">
          <span className="text-app-text-primary font-semibold text-sm tracking-wide">User Info</span>
          <button 
            onClick={onClose} 
            className="p-1.5 text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover rounded-full transition cursor-pointer"
            title="Close Profile"
          >
            <X size={18} />
          </button>
        </div>

        {/* AVATAR & BASIC DETAILS CARD */}
        <div className="relative flex flex-col items-center px-6 pt-8 pb-6 border-b border-app-border bg-transparent shrink-0">
          
          {/* Avatar Container with Glowing Pulse Ring */}
          <div className="relative group">
            {isOnline && (
              <span className="absolute -inset-1 rounded-full bg-gradient-to-tr from-emerald-400 to-teal-500 blur-sm opacity-60 group-hover:opacity-90 transition duration-1000 group-hover:duration-200 animate-pulse" />
            )}
            <div 
              onClick={() => setIsImageViewerOpen(true)}
              className={`relative w-24 h-24 rounded-full overflow-hidden border-2 bg-app-card cursor-pointer hover:scale-105 active:scale-95 transition-all duration-300 shadow-md ${
                isOnline ? "border-emerald-400" : "border-app-border"
              }`}
              title="View Full Profile Photo"
            >
              {user.avatar ? (
                <img 
                  src={user.avatar} 
                  alt={user.username} 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-brand/15 to-indigo-500/15 dark:from-brand/25 dark:to-indigo-950/25 text-brand dark:text-white font-bold text-3xl">
                  {user.username ? user.username.charAt(0).toUpperCase() : "?"}
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[9px] text-white font-bold uppercase tracking-wider">
                Zoom
              </div>
            </div>
            {isOnline && (
              <span className="absolute bottom-0 right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0e0e11]" />
            )}
          </div>

          <div className="text-center mt-4">
            <h2 className="text-app-text-primary text-xl font-bold tracking-tight">
              {user.username}
            </h2>
            
            <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-app-text-secondary">
              {isOnline ? (
                <span className="inline-flex items-center gap-1.2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Active Now
                </span>
              ) : (
                <span className="flex items-center gap-1 font-semibold opacity-80">
                  {formatLastSeen(lastSeenVal)}
                </span>
              )}
            </div>
          </div>

          {/* Unified Stats & Action Control Panel */}
          <div className="w-full max-w-sm mt-5 p-4.5 rounded-3xl bg-app-card/65 dark:bg-app-card/35 border border-app-border/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] space-y-4">
            {/* Followers / Following Stats Row */}
            <div className="flex items-center justify-around py-1">
              <button 
                onClick={() => openFollowList("followers")}
                className="flex-1 text-center hover:text-brand transition cursor-pointer group"
              >
                <span className="block text-app-text-primary font-bold text-lg group-hover:text-brand transition-colors leading-none tracking-tight">{followStats.followersCount}</span>
                <span className="text-app-text-secondary text-[9px] font-semibold uppercase tracking-wider mt-1 block opacity-75">Followers</span>
              </button>
              <div className="w-px bg-app-border/60 h-7" />
              <button 
                onClick={() => openFollowList("following")}
                className="flex-1 text-center hover:text-brand transition cursor-pointer group"
              >
                <span className="block text-app-text-primary font-bold text-lg group-hover:text-brand transition-colors leading-none tracking-tight">{followStats.followingCount}</span>
                <span className="text-app-text-secondary text-[9px] font-semibold uppercase tracking-wider mt-1 block opacity-75">Following</span>
              </button>
            </div>

            {/* Accent divider */}
            <div className="h-px bg-app-border/50" />

            {/* Action Buttons Grid */}
            {!isMe && (
              <div className="flex gap-2 items-center w-full justify-center">
                {followStats.status === "blocked" ? (
                  <button
                    onClick={handleUnblock}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold uppercase tracking-wider rounded-xl transition shadow-md hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Shield size={14} /> Unblock User
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleToggleFollow}
                      className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm ${
                        followStats.status === "following" || followStats.status === "mutual_follow" || followStats.status === "requested"
                          ? "bg-app-hover hover:bg-app-hover/80 text-app-text-primary border border-app-border"
                          : "bg-brand hover:bg-brand/90 text-white hover:shadow-md hover:shadow-brand/20"
                      }`}
                    >
                      {followStats.status === "following"
                        ? "Following"
                        : followStats.status === "mutual_follow"
                        ? "Mutual Follow"
                        : followStats.status === "requested"
                        ? "Requested"
                        : followStats.status === "follower"
                        ? "Follow Back"
                        : "Follow"}
                    </button>
                    
                    {onStartDM && followStats.status !== "blocked" && (
                      <button
                        onClick={() => onStartDM(user)}
                        className="p-2.5 bg-app-hover text-app-text-primary hover:text-brand hover:bg-app-hover/90 rounded-xl border border-app-border hover:border-brand/20 transition hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                        title="Message User"
                      >
                        <Mail size={15} />
                      </button>
                    )}

                    <button
                      onClick={handleBlock}
                      className="px-3.5 py-2.5 bg-transparent hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 border border-red-200 dark:border-red-900/50 hover:border-red-300 text-xs font-semibold uppercase tracking-wider rounded-xl transition hover:scale-[1.02] active:scale-95 cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
                    >
                      <Ban size={14} /> Block
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* DETAILS SECTION */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* SINGLE INTEGRATED METADATA CARD */}
          <div className="premium-info-card rounded-3xl p-5 space-y-6">
            
            {/* ABOUT */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[10px] text-brand font-bold uppercase tracking-wider opacity-85">
                <Info size={13} className="text-brand" /> About User
              </div>
              <p className="text-app-text-primary text-sm leading-relaxed break-words font-medium opacity-90">
                {user.about || user.status || "Hey there! I am using Vertex Connect."}
              </p>
            </div>

            {/* Divider */}
            <div className="h-px bg-app-border/60" />

            {/* CONTACT INFO (EMAIL) */}
            {user.email && (
              <div className="space-y-2 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] text-brand font-bold uppercase tracking-wider opacity-85">
                    <Mail size={13} className="text-brand" /> Email Address
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(user.email);
                      toast.success("Email copied to clipboard");
                    }}
                    className="p-1.5 text-app-text-secondary hover:text-brand hover:bg-app-hover rounded-lg border border-transparent hover:border-app-border transition cursor-pointer shrink-0"
                    title="Copy Email"
                  >
                    <Copy size={13} />
                  </button>
                </div>
                <p className="text-app-text-primary text-sm font-medium tracking-normal break-all opacity-90">
                  {user.email}
                </p>
              </div>
            )}

            {/* Divider */}
            <div className="h-px bg-app-border/60" />

            {/* SHARED GROUPS */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] text-brand font-bold uppercase tracking-wider opacity-85">
                <Users size={13} className="text-brand" /> Shared Groups ({sharedGroups.length})
              </div>
              
              {sharedGroups.length === 0 ? (
                <p className="text-app-text-secondary text-xs italic opacity-80">No shared groups with this user</p>
              ) : (
                <div className="space-y-2">
                  {sharedGroups.map((g) => (
                    <div 
                      key={g._id} 
                      className="flex items-center gap-3 p-2 hover:bg-app-hover/80 dark:hover:bg-app-hover/40 rounded-xl border border-transparent hover:border-app-border/40 transition duration-200"
                    >
                      {/* Minimal group avatar or initials */}
                      {g.groupAvatar ? (
                        <img src={g.groupAvatar} alt={g.chatName} className="w-8 h-8 rounded-full object-cover border border-app-border/60" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-brand/10 dark:bg-brand/25 text-brand dark:text-white flex items-center justify-center font-bold text-xs border border-app-border/60">
                          {g.chatName ? g.chatName.charAt(0).toUpperCase() : "G"}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-app-text-primary text-xs font-semibold truncate">{g.chatName}</p>
                        <p className="text-app-text-secondary text-[10px] truncate opacity-80">{g.participants?.length || 0} members</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* SECURE FOOTER */}
        <div className="bg-app-header/40 p-4 border-t border-app-border flex items-center justify-center text-[10px] text-app-text-secondary font-semibold tracking-wider uppercase shrink-0">
          Vertex Connect Secure Verification
        </div>

        {/* FOLLOW LIST INLINE OVERLAY */}
        {followListOpen && (
          <div className="absolute inset-0 bg-app-drawer z-[60] flex flex-col animate-slide-in select-none">
            {/* HEADER */}
            <div className="h-[60px] bg-app-header flex items-center p-4 gap-4 border-b border-app-border shrink-0">
              <button
                onClick={() => setFollowListOpen(false)}
                className="p-1.5 text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover rounded-full transition cursor-pointer"
              >
                <ArrowLeft size={18} />
              </button>
              <span className="text-app-text-primary font-semibold text-sm capitalize">
                {followListType} ({followUsers.length})
              </span>
            </div>

            {/* LIST */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {listLoading ? (
                <div className="flex justify-center items-center h-full">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand"></div>
                </div>
              ) : followUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-app-text-secondary text-xs">
                  No users found
                </div>
              ) : (
                followUsers.map((u) => (
                  <div key={u._id} className="flex items-center gap-3 p-2.5 bg-app-card rounded-xl border border-app-border/60 hover:border-brand/30 hover:shadow-sm transition duration-200">
                    <div className="w-9 h-9 rounded-full bg-brand overflow-hidden flex items-center justify-center shrink-0 border border-app-border">
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.username} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-sm font-bold">
                          {u.username ? u.username.charAt(0).toUpperCase() : "?"}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-app-text-primary text-xs font-semibold truncate leading-tight">
                        {u.username}
                      </div>
                      <div className="text-app-text-secondary text-[10px] mt-0.5 truncate leading-tight">
                        {u.status || u.about || "Active member"}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ENLARGED PROFILE IMAGE INLINE OVERLAY */}
        {isImageViewerOpen && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-[70] flex flex-col items-center justify-center p-6 animate-fade-in text-app-text-primary">
            <div className="relative w-full max-w-[280px] sm:max-w-[300px] flex flex-col items-center gap-4">
              <button
                onClick={() => setIsImageViewerOpen(false)}
                className="absolute -top-12 right-0 p-2 text-app-text-secondary hover:text-white bg-app-header hover:bg-app-hover border border-app-border rounded-full transition shadow-lg cursor-pointer"
                title="Close Preview"
              >
                <X size={18} />
              </button>
              
              <div className="w-full aspect-square rounded-2xl overflow-hidden border border-app-border bg-app-drawer shadow-2xl animate-scale-in">
                {user.avatar ? (
                  <img 
                    src={user.avatar} 
                    alt={user.username} 
                    className="w-full h-full object-cover animate-scale-in" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-5xl bg-brand/10 dark:bg-brand/25 text-brand dark:text-white">
                    {user.username ? user.username.charAt(0).toUpperCase() : "?"}
                  </div>
                )}
              </div>

              <span className="text-white text-sm font-semibold tracking-wide truncate max-w-full">
                {user.username}
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default UserProfileModal;
