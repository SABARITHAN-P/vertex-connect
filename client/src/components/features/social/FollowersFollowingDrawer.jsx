import React, { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Search, UserMinus, UserCheck, MessageSquare, ShieldAlert, Users, Compass } from "lucide-react";
import api from "@services/api";
import { useEscapeKey } from "@hooks/useEscapeKey";
import { socket } from "@socket/socket";
import toast from "react-hot-toast";

function FollowersFollowingDrawer({ onClose, currentUserId, onOpenChat }) {
  const [activeTab, setActiveTab] = useState("followers"); // "followers" or "following"
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [sortOrder, setSortOrder] = useState("latest"); // "latest" or "oldest"

  // Close drawer on Escape key (Priority: 7)
  useEscapeKey(onClose, true, 7);

  // Fetch lists
  const fetchLists = async () => {
    try {
      setLoading(true);
      const followersRes = await api.get(`/user/follow/followers/${currentUserId}`);
      const followingRes = await api.get(`/user/follow/following/${currentUserId}`);
      setFollowers(followersRes.data || []);
      setFollowing(followingRes.data || []);
    } catch (error) {
      console.error("Failed to load followers/following lists:", error);
      toast.error("Failed to load follow lists");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();

    // Listen to real-time follow status updates via Socket.io
    const handleFollowUpdate = () => {
      fetchLists();
    };

    socket.on("follow:update", handleFollowUpdate);
    return () => {
      socket.off("follow:update", handleFollowUpdate);
    };
  }, [currentUserId]);

  // Unfollow action
  const handleUnfollow = async (userId, username) => {
    try {
      // Toggle follow will toggle from following -> not_following
      const res = await api.post(`/user/follow/${userId}`);
      toast.success(res.data.message || `Unfollowed ${username}`);
      
      // Update local state immediately
      setFollowing((prev) => prev.filter((u) => u._id !== userId));
    } catch (error) {
      console.error("Failed to unfollow user:", error);
      toast.error(`Failed to unfollow ${username}`);
    }
  };

  // Remove follower action
  const handleRemoveFollower = async (userId, username) => {
    try {
      await api.delete(`/user/follow/follower/${userId}`);
      toast.success(`Removed ${username} from followers`);
      
      // Update local state immediately
      setFollowers((prev) => prev.filter((u) => u._id !== userId));
    } catch (error) {
      console.error("Failed to remove follower:", error);
      toast.error(`Failed to remove ${username}`);
    }
  };

  // Start DM from lists
  const handleStartDM = async (user) => {
    try {
      const res = await api.post("/chat", { userId: user._id });
      const activeChat = res.data;
      
      // Call parent handleOpenChat callback (if provided)
      if (onOpenChat) {
        if (activeChat.isGroupChat) {
          onOpenChat({
            _id: activeChat._id,
            username: activeChat.chatName,
            avatar: activeChat.groupAvatar,
            chatId: activeChat._id,
            isGroupChat: true,
            fullChat: activeChat,
          });
        } else {
          onOpenChat({
            ...user,
            chatId: activeChat._id,
            isGroupChat: false,
            fullChat: activeChat,
          });
        }
      }
      onClose(); // Close settings & following drawer
    } catch (err) {
      console.error("Failed to open or create chat:", err);
      toast.error("Failed to start direct message");
    }
  };

  // Filters and sorts lists dynamically for high performance
  const filteredFollowers = useMemo(() => {
    const list = followers.filter((u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.about && u.about.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    return list.sort((a, b) => {
      const dateA = new Date(a.followedAt || 0);
      const dateB = new Date(b.followedAt || 0);
      return sortOrder === "latest" ? dateB - dateA : dateA - dateB;
    });
  }, [followers, searchQuery, sortOrder]);

  const filteredFollowing = useMemo(() => {
    const list = following.filter((u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.about && u.about.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    return list.sort((a, b) => {
      const dateA = new Date(a.followedAt || 0);
      const dateB = new Date(b.followedAt || 0);
      return sortOrder === "latest" ? dateB - dateA : dateA - dateB;
    });
  }, [following, searchQuery, sortOrder]);

  const currentList = activeTab === "followers" ? filteredFollowers : filteredFollowing;

  return (
    <div className="absolute inset-0 bg-app-drawer text-app-text-primary z-50 flex flex-col transition-transform duration-300 transform translate-x-0 select-none animate-fade-in">
      {/* HEADER */}
      <div className="h-[60px] bg-app-header flex items-center p-4 gap-4 border-b border-app-border shrink-0">
        <button
          onClick={onClose}
          className="p-1.5 text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover rounded-full transition"
          title="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="text-app-text-primary font-semibold text-lg">Social Circle</span>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-app-border bg-app-header/40 p-1 mx-4 mt-4 rounded-xl">
        <button
          onClick={() => {
            setActiveTab("followers");
            setSearchQuery("");
          }}
          className={`flex-1 py-2 text-center text-sm font-semibold rounded-lg transition-all duration-200 ${
            activeTab === "followers"
              ? "bg-brand text-white shadow-md cursor-pointer"
              : "text-app-text-secondary hover:text-app-text-primary cursor-pointer"
          }`}
        >
          Followers ({followers.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("following");
            setSearchQuery("");
          }}
          className={`flex-1 py-2 text-center text-sm font-semibold rounded-lg transition-all duration-200 ${
            activeTab === "following"
              ? "bg-brand text-white shadow-md cursor-pointer"
              : "text-app-text-secondary hover:text-app-text-primary cursor-pointer"
          }`}
        >
          Following ({following.length})
        </button>
      </div>

      {/* LOCAL SEARCH BAR WITH PREMIUM SORT TOGGLER */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <div className="flex-1 bg-app-header border border-app-border rounded-xl flex items-center px-4 focus-within:border-brand transition-all duration-200">
          <Search size={16} className="text-app-text-secondary shrink-0" />
          <input
            type="text"
            placeholder={`Search ${activeTab}`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent outline-none px-3 py-2.5 text-xs text-app-text-primary placeholder-app-text-secondary"
          />
        </div>

        <button
          onClick={() => setSortOrder(prev => prev === "latest" ? "oldest" : "latest")}
          className="h-10 px-3 bg-app-header border border-app-border hover:bg-app-hover rounded-xl flex items-center gap-1.5 text-app-text-secondary hover:text-app-text-primary transition-all duration-200 active:scale-95 shrink-0 cursor-pointer"
          title={`Sorting by ${sortOrder}`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider">{sortOrder}</span>
          <div className="flex flex-col items-center -space-y-1">
            <span className={`text-[8px] transition-colors duration-200 ${sortOrder === "latest" ? "text-brand font-black" : "text-app-text-secondary/40"}`}>▲</span>
            <span className={`text-[8px] transition-colors duration-200 ${sortOrder === "oldest" ? "text-brand font-black" : "text-app-text-secondary/40"}`}>▼</span>
          </div>
        </button>
      </div>

      {/* BODY LIST CONTAINER */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
          </div>
        ) : currentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-4">
            <div className="p-4 bg-brand/10 rounded-full text-brand animate-pulse">
              {activeTab === "followers" ? <Users size={32} /> : <Compass size={32} />}
            </div>
            <div>
              <h3 className="text-app-text-primary font-semibold text-sm">
                {searchQuery ? "No matching contacts" : activeTab === "followers" ? "No followers yet" : "Not following anyone"}
              </h3>
              <p className="text-app-text-secondary text-xs mt-1 leading-relaxed max-w-[240px]">
                {searchQuery
                  ? "Try refining your search terms to locate specific connections."
                  : activeTab === "followers"
                  ? "When other users follow your profile, they will appear here."
                  : "Explore global search in the sidebar to follow friends and start chatting!"}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {currentList.map((user) => (
              <div
                key={user._id}
                className="bg-app-header border border-app-border rounded-xl p-3.5 flex items-center justify-between hover:bg-app-hover hover:border-app-border/80 transition duration-200"
              >
                {/* User Info with profile modal trigger */}
                <div 
                  className="flex items-center gap-3 min-w-0 cursor-pointer"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("view-user-profile", { detail: user }));
                  }}
                  title="View Profile Details"
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.username}
                      className="w-10 h-10 rounded-full object-cover border border-app-border shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-brand/10 dark:bg-brand/25 border border-brand/30 flex items-center justify-center text-xs font-bold text-brand dark:text-white uppercase shrink-0">
                      {user.username[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="text-app-text-primary font-semibold text-xs truncate hover:underline">
                      {user.username}
                    </h4>
                    <p className="text-app-text-secondary text-[10px] truncate mt-0.5 max-w-[170px]">
                      {user.about || "Hey there! I am using Vertex Connect."}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleStartDM(user)}
                    className="w-8 h-8 rounded-full bg-brand/10 border border-brand/20 hover:bg-brand hover:border-transparent text-brand hover:text-white flex items-center justify-center transition duration-200 cursor-pointer"
                    title="Send Direct Message"
                  >
                    <MessageSquare size={14} />
                  </button>

                  {activeTab === "followers" ? (
                    <button
                      onClick={() => handleRemoveFollower(user._id, user.username)}
                      className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:border-transparent text-red-500 hover:text-white flex items-center justify-center transition duration-200"
                      title="Remove Follower"
                    >
                      <UserMinus size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUnfollow(user._id, user.username)}
                      className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500 hover:border-transparent text-amber-500 hover:text-white flex items-center justify-center transition duration-200"
                      title="Unfollow User"
                    >
                      <UserMinus size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default FollowersFollowingDrawer;
