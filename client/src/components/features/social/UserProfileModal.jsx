import { useEffect, useState } from "react";
import { X, Mail, Users, Info, ArrowLeft, Shield } from "lucide-react";
import { formatLastSeen } from "@utils/dateFormatter";
import { useEscapeKey } from "@hooks/useEscapeKey";
import axios from "axios";

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

  // Centralized ESC handling: close sub-pages or overlays first, then the modal itself
  useEscapeKey(() => setFollowListOpen(false), isOpen && followListOpen, 30);
  useEscapeKey(() => setIsImageViewerOpen(false), isOpen && isImageViewerOpen, 20);
  useEscapeKey(onClose, isOpen && !isImageViewerOpen && !followListOpen, 10);

  useEffect(() => {
    if (isOpen && user?._id) {
      fetchFollowStatus();
    }
  }, [isOpen, user?._id]);

  const fetchFollowStatus = async () => {
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
  };

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-app-modal border border-app-border rounded-2xl shadow-2xl overflow-hidden flex flex-col relative animate-scale-up text-app-text-primary">
        
        {/* CLOSE BUTTON */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 text-app-text-secondary hover:text-app-text-primary bg-black/40 hover:bg-black/60 rounded-full transition-all cursor-pointer"
          title="Close Modal"
        >
          <X size={18} />
        </button>

        {/* PROFILE HEADER/AVATAR */}
        <div className="relative h-[300px] bg-app-header/40 border-b border-app-border flex flex-col items-center justify-center gap-2">
          <div 
            onClick={() => setIsImageViewerOpen(true)}
            className="w-24 h-24 rounded-full overflow-hidden border-2 border-brand bg-app-hover cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-lg relative group"
            title="View Full Profile Photo"
          >
            {user.avatar ? (
              <img 
                src={user.avatar} 
                alt={user.username} 
                className="w-full h-full object-cover" 
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-brand/10 dark:bg-brand/25 text-brand dark:text-white font-bold text-3xl">
                {user.username ? user.username.charAt(0).toUpperCase() : "?"}
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[8px] text-white font-bold uppercase tracking-wider">
              Zoom
            </div>
          </div>

          <div className="text-center flex flex-col items-center">
            <h2 className="text-app-text-primary text-base font-semibold truncate max-w-[280px] flex items-center gap-1.5">
              {user.username}
              {!isMe && (
                <span className="text-[10px] font-normal text-app-text-secondary bg-app-input px-2 py-0.5 rounded border border-app-border">
                  {followStats.status === "mutual_follow" ? "mutual" : "member"}
                </span>
              )}
            </h2>
            <p className={`text-xs mt-0.5 font-medium ${isOnline ? "text-brand" : "text-app-text-secondary"}`}>
              {isOnline ? "online" : formatLastSeen(lastSeenVal)}
            </p>

            {/* Follow stats */}
            <div className="flex gap-6 mt-3 text-xs">
              <button 
                onClick={() => openFollowList("followers")}
                className="text-app-text-primary hover:text-brand transition flex flex-col items-center cursor-pointer"
              >
                <span className="text-app-text-primary font-bold text-sm">{followStats.followersCount}</span>
                <span className="text-app-text-secondary text-[10px] uppercase tracking-wider">Followers</span>
              </button>
              <button 
                onClick={() => openFollowList("following")}
                className="text-app-text-primary hover:text-brand transition flex flex-col items-center cursor-pointer"
              >
                <span className="text-app-text-primary font-bold text-sm">{followStats.followingCount}</span>
                <span className="text-app-text-secondary text-[10px] uppercase tracking-wider">Following</span>
              </button>
            </div>

            {/* Follow / Block controls */}
            {!isMe && (
              <div className="flex gap-2 mt-3.5 items-center">
                {followStats.status === "blocked" ? (
                  <button
                    onClick={handleUnblock}
                    className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-full transition shadow-md hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    Unblock
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleToggleFollow}
                      className={`px-5 py-2 text-[10px] font-bold uppercase tracking-wider rounded-full transition shadow-md hover:scale-105 active:scale-95 cursor-pointer ${
                        followStats.status === "following" || followStats.status === "mutual_follow" || followStats.status === "requested"
                          ? "bg-app-hover text-app-text-primary border border-app-border hover:bg-app-hover/80"
                          : "bg-brand text-white hover:bg-brand/90"
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
                    <button
                      onClick={handleBlock}
                      className="px-3.5 py-2 bg-transparent hover:bg-red-600/10 text-red-500 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 text-[10px] font-bold uppercase tracking-wider rounded-full transition hover:scale-105 active:scale-95 cursor-pointer"
                    >
                      Block
                    </button>
                  </>
                )}

                {onStartDM && followStats.status !== "blocked" && (
                  <button
                    onClick={() => onStartDM(user)}
                    className="p-2 bg-app-hover text-app-text-primary hover:bg-app-hover/85 rounded-full border border-app-border transition cursor-pointer"
                    title="Message User"
                  >
                    <Mail size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* DETAILS SECTION */}
        <div className="p-5 space-y-4 max-h-[260px] overflow-y-auto">
          {/* ABOUT/BIO */}
          <div className="bg-app-input/20 border border-app-border/60 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-brand font-bold uppercase tracking-wider">
              <Info size={14} /> About
            </div>
            <p className="text-app-text-primary text-sm leading-relaxed break-words">
              {user.about || user.status || "Hey there! I am using Vertex Connect."}
            </p>
          </div>

          {/* CONTACT INFO (EMAIL) */}
          {user.email && (
            <div className="bg-app-input/20 border border-app-border/60 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-brand font-bold uppercase tracking-wider">
                <Mail size={14} /> Contact Information
              </div>
              <p className="text-app-text-primary text-sm select-all">
                {user.email}
              </p>
            </div>
          )}

          {/* SHARED GROUPS */}
          <div className="bg-app-input/20 border border-app-border/60 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-brand font-bold uppercase tracking-wider">
              <Users size={14} /> Shared Groups
            </div>
            <p className="text-app-text-primary text-sm font-medium">
              {sharedGroups.length === 0 
                ? "No shared groups" 
                : `${sharedGroups.length} shared group${sharedGroups.length > 1 ? "s" : ""}`
              }
            </p>
            {sharedGroups.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {sharedGroups.map((g) => (
                  <span 
                    key={g._id} 
                    className="text-[10px] bg-app-hover text-app-text-secondary px-2 py-0.5 rounded border border-app-border"
                  >
                    {g.chatName}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="bg-app-input/20 p-4 border-t border-app-border flex items-center justify-center text-[10px] text-app-text-secondary font-semibold tracking-wider uppercase">
          Vertex Connect Secure Verification
        </div>

        {/* FOLLOW LIST INLINE OVERLAY */}
        {followListOpen && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-30 flex flex-col animate-fade-in select-none">
            {/* HEADER */}
            <div className="h-[60px] bg-app-header flex items-center p-4 gap-4 border-b border-app-border shrink-0">
              <button
                onClick={() => setFollowListOpen(false)}
                className="p-1.5 text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover rounded-full transition cursor-pointer"
              >
                <ArrowLeft size={20} />
              </button>
              <span className="text-app-text-primary font-semibold text-sm capitalize">
                {followListType} ({followUsers.length})
              </span>
            </div>

            {/* LIST */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
                  <div key={u._id} className="flex items-center gap-3 p-2 bg-app-input/30 rounded-xl border border-app-border/60">
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
          <div className="absolute inset-0 bg-app-drawer/95 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 animate-fade-in text-app-text-primary">
            <div className="relative w-full max-w-[280px] sm:max-w-[300px] flex flex-col items-center gap-4">
              <button
                onClick={() => setIsImageViewerOpen(false)}
                className="absolute -top-12 right-0 p-2 text-app-text-secondary hover:text-app-text-primary bg-app-header hover:bg-app-hover border border-app-border rounded-full transition shadow-lg cursor-pointer"
                title="Close Preview"
              >
                <X size={18} />
              </button>
              
              <div className="w-full aspect-square rounded-xl overflow-hidden border border-app-border bg-app-drawer shadow-2xl animate-scale-up">
                {user.avatar ? (
                  <img 
                    src={user.avatar} 
                    alt={user.username} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-5xl bg-brand/10 dark:bg-brand/25 text-brand dark:text-white">
                    {user.username ? user.username.charAt(0).toUpperCase() : "?"}
                  </div>
                )}
              </div>

              <span className="text-app-text-primary text-sm font-semibold tracking-wide truncate max-w-full">
                {user.username}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserProfileModal;
