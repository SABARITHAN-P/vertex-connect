import { useEffect, useMemo, useState } from "react";
import api from "@services/api";
import ConversationItem from "@components/features/chat/ConversationItem";
import { useBackButton } from "@hooks/useBackButton";
import CreateGroupModal from "@components/features/group/CreateGroupModal";
import ProfileSettingsDrawer from "@components/features/settings/ProfileSettingsDrawer";
import SettingsDrawer from "@components/features/settings/SettingsDrawer";
import FollowRequestsDrawer from "@components/features/social/FollowRequestsDrawer";
import { Search, Users, Pin, PinOff, Archive, ArchiveRestore, Lock, Unlock, CheckCheck, MailOpen, Mail, UserX, Eraser, Trash2, ArrowLeft, UserCheck, Phone, Sparkles, Pencil, MessageSquare, Plus, Sun, Moon, Settings, UserPlus, X } from "lucide-react";
import { useEscapeKey } from "@hooks/useEscapeKey";
import CallsDrawer from "@components/features/calls/CallsDrawer";
import toast from "react-hot-toast";
import { socket } from "@socket/socket";
import { useTheme } from "@context/ThemeContext";
import { premiumConfirm, premiumAlert } from "@utils/alert";

function Sidebar({
  selectedUser,
  setSelectedUser,
  unreadCounts,
  typingUsers,
  chats,
  setChats,
  onlineUsers = [],
  currentUser,
  setCurrentUser,
  archivedChats = [],
  lockedChats = []
}) {
  const [search, setSearch] = useState("");
  const { theme, updateAppearance } = useTheme();

  const [activeTab, setActiveTab] = useState("chats"); // "chats" | "groups" | "ai"
  const [aiConversations, setAiConversations] = useState([]);
  const [editingAiId, setEditingAiId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  const fetchAiConversations = async () => {
    try {
      const { data } = await api.get("/ai/conversations");
      setAiConversations(data || []);
    } catch (err) {
      console.error("Failed to load AI conversations:", err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAiConversations();

    const handleUpdateEvent = () => {
      fetchAiConversations();
    };

    window.addEventListener("ai-conversations-updated", handleUpdateEvent);
    return () => {
      window.removeEventListener("ai-conversations-updated", handleUpdateEvent);
    };
  }, []);

  const handleCreateAiConversation = async () => {
    try {
      const { data } = await api.post("/ai/conversations", {
        title: "New AI Chat",
        model: "gemma:latest"
      });
      setAiConversations(prev => [data, ...prev]);
      handleOpenAiConversation(data);
      toast.success("New AI conversation created!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to create AI conversation");
    }
  };

  const handleOpenAiConversation = (conv) => {
    setSelectedUser({
      _id: conv._id,
      chatId: conv._id,
      isAiChat: true,
      conversation: conv,
    });
  };

  const handleDeleteAiConversation = async (e, convId) => {
    e.stopPropagation();
    const confirmed = await premiumConfirm(
      "Delete AI Chat",
      "Are you sure you want to delete this AI conversation?",
      "warning"
    );
    if (confirmed) {
      try {
        await api.delete(`/ai/conversations/${convId}`);
        setAiConversations(prev => prev.filter(c => c._id !== convId));
        if (selectedUser?.isAiChat && selectedUser._id === convId) {
          setSelectedUser(null);
        }
        toast.success("AI Conversation deleted.");
      } catch (err) {
        console.error(err);
        toast.error("Failed to delete conversation");
      }
    }
  };

  const handleStartRename = (e, conv) => {
    e.stopPropagation();
    setEditingAiId(conv._id);
    setEditingTitle(conv.title);
  };

  const handleSaveRename = async (convId) => {
    if (!editingTitle.trim()) return;
    try {
      const { data } = await api.put(`/ai/conversations/${convId}`, {
        title: editingTitle,
      });
      setAiConversations(prev => prev.map(c => c._id === convId ? data : c));
      setEditingAiId(null);
      if (selectedUser?.isAiChat && selectedUser._id === convId) {
        setSelectedUser(prev => ({
          ...prev,
          conversation: data
        }));
      }
      toast.success("Conversation renamed.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to rename conversation");
    }
  };

  // Centralized ESC key support: clear search query on Escape. Priority: 5
  useEscapeKey(() => setSearch(""), search.trim() !== "", 5);
  const [loadingChat, setLoadingChat] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showCalls, setShowCalls] = useState(false);
  const [globalUsers, setGlobalUsers] = useState([]);

  const [imgError, setImgError] = useState(false);

  // Context Menu & Deletion/Clearance State
  const [contextMenu, setContextMenu] = useState(null); // { x: number, y: number, chat: object }
  const [pinnedChatIds, setPinnedChatIds] = useState(() => {
    return JSON.parse(localStorage.getItem("pinned_chats") || "[]");
  });

  // Folder states
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [showLockedOnly, setShowLockedOnly] = useState(false);

  const [requestCount, setRequestCount] = useState(0);
  const [showFollowRequests, setShowFollowRequests] = useState(false);
  const [unseenMissedCalls, setUnseenMissedCalls] = useState(0);

  useBackButton(() => setShowProfile(false), showProfile, "sidebar-profile");
  useBackButton(() => setShowSettings(false), showSettings, "sidebar-settings");
  useBackButton(() => setShowFollowRequests(false), showFollowRequests, "sidebar-follow-requests");
  useBackButton(() => setShowCalls(false), showCalls, "sidebar-calls");
  useBackButton(() => setShowCreateGroup(false), showCreateGroup, "sidebar-create-group");

  const fetchRequestCount = async () => {
    try {
      const { data } = await api.get("/user/follow/requests");
      setRequestCount(data.length);
    } catch (error) {
      console.error("Failed to fetch follow requests count:", error);
    }
  };

  const fetchUnseenCallsCount = async () => {
    try {
      const { data } = await api.get("/call/unseen-count");
      setUnseenMissedCalls(data.count || 0);
    } catch (error) {
      console.error("Failed to fetch unseen calls count:", error);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRequestCount();
    fetchUnseenCallsCount();

    const handleUnseenUpdate = () => {
      fetchUnseenCallsCount();
    };

    socket.on("call:unseen-update", handleUnseenUpdate);

    const interval = setInterval(() => {
      fetchRequestCount();
      fetchUnseenCallsCount();
    }, 15000);

    return () => {
      clearInterval(interval);
      socket.off("call:unseen-update", handleUnseenUpdate);
    };
  }, []);

  // Passcode modal states
  const [passcodePrompt, setPasscodePrompt] = useState(null); // null | { type: 'lock' | 'unlock' | 'unlock-folder', chat?: object }
  const [passcodeValue, setPasscodeValue] = useState("");

  const [prevAvatar, setPrevAvatar] = useState(currentUser.avatar);
  if (currentUser.avatar !== prevAvatar) {
    setPrevAvatar(currentUser.avatar);
    setImgError(false);
  }

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const currentUserId = currentUser._id || currentUser.id;

  const totalPrivateUnreads = useMemo(() => {
    return chats
      .filter((chat) => {
        const isArchived = chat.archivedBy?.some(a => a.user.toString() === currentUserId);
        const isLocked = chat.lockedBy?.some(l => l.user.toString() === currentUserId);
        return !chat.isGroupChat && !isArchived && !isLocked;
      })
      .reduce((sum, chat) => sum + (unreadCounts?.[chat._id] || 0), 0);
  }, [chats, unreadCounts, currentUserId]);

  const totalGroupUnreads = useMemo(() => {
    return chats
      .filter((chat) => {
        const isArchived = chat.archivedBy?.some(a => a.user.toString() === currentUserId);
        const isLocked = chat.lockedBy?.some(l => l.user.toString() === currentUserId);
        return chat.isGroupChat && !isArchived && !isLocked;
      })
      .reduce((sum, chat) => sum + (unreadCounts?.[chat._id] || 0), 0);
  }, [chats, unreadCounts, currentUserId]);

  const archivedChatsCount = archivedChats.length;
  const lockedChatsCount = lockedChats.length;

  const filteredChats = useMemo(() => {
    return chats.filter((chat) => {
      // Hide archived and locked chats from main active list
      const isArchived = chat.archivedBy?.some(a => a.user.toString() === currentUserId);
      const isLocked = chat.lockedBy?.some(l => l.user.toString() === currentUserId);
      if (isArchived || isLocked) return false;

      // Filter by active tab
      if (activeTab === "chats" && chat.isGroupChat) return false;
      if (activeTab === "groups" && !chat.isGroupChat) return false;
      if (activeTab === "ai") return false;

      if (chat.isGroupChat) {
        return chat.chatName?.toLowerCase().includes(search.toLowerCase());
      }
      const otherUser = chat.participants.find((u) => u._id !== currentUserId);
      return otherUser?.username.toLowerCase().includes(search.toLowerCase());
    });
  }, [chats, search, currentUserId, activeTab]);

  const sortedChats = useMemo(() => {
    return [...filteredChats].sort((a, b) => {
      const aPinned = a.pinnedBy?.some(p => p.user.toString() === currentUserId) || pinnedChatIds.includes(a._id);
      const bPinned = b.pinnedBy?.some(p => p.user.toString() === currentUserId) || pinnedChatIds.includes(b._id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      const aTime = new Date(a.lastMessage?.createdAt || a.updatedAt);
      const bTime = new Date(b.lastMessage?.createdAt || b.updatedAt);
      return bTime - aTime;
    });
  }, [filteredChats, pinnedChatIds, currentUserId]);

  const chatsToRender = useMemo(() => {
    if (showArchivedOnly) {
      return archivedChats.filter(chat => {
        if (chat.isGroupChat) {
          return chat.chatName?.toLowerCase().includes(search.toLowerCase());
        }
        const otherUser = chat.participants.find((u) => u._id !== currentUserId);
        return otherUser?.username.toLowerCase().includes(search.toLowerCase());
      });
    }
    if (showLockedOnly) {
      return lockedChats.filter(chat => {
        if (chat.isGroupChat) {
          return chat.chatName?.toLowerCase().includes(search.toLowerCase());
        }
        const otherUser = chat.participants.find((u) => u._id !== currentUserId);
        return otherUser?.username.toLowerCase().includes(search.toLowerCase());
      });
    }
    return sortedChats;
  }, [showArchivedOnly, showLockedOnly, archivedChats, lockedChats, sortedChats, search, currentUserId]);

  const filteredAiConversations = useMemo(() => {
    return aiConversations.filter(c =>
      c.title?.toLowerCase().includes(search.toLowerCase())
    );
  }, [aiConversations, search]);

  /* =========================
     CONTEXT MENU ACTIONS
  ========================== */
  const handleContextMenu = (e, chat) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      chat,
    });
  };

  const handlePinChat = async (chat) => {
    try {
      const res = await api.post(`/chat/pin/${chat._id}`);
      const isPinned = res.data.isPinned;

      setPinnedChatIds((prev) => {
        const next = isPinned
          ? [...prev.filter((id) => id !== chat._id), chat._id]
          : prev.filter((id) => id !== chat._id);
        localStorage.setItem("pinned_chats", JSON.stringify(next));
        return next;
      });

      setChats((prev) =>
        prev.map((c) =>
          c._id === chat._id
            ? { ...c, pinnedBy: isPinned ? [{ user: currentUserId, pinnedAt: new Date() }] : [] }
            : c
        )
      );

      toast.success(isPinned ? "Chat pinned successfully" : "Chat unpinned successfully");
    } catch (err) {
      console.error("Failed to pin chat:", err);
      if (err.response?.data?.message) {
        premiumAlert("Pin Limit Reached", err.response.data.message, "warning");
      } else {
        premiumAlert("Error", "Failed to toggle pin state", "error");
      }
    }
    setContextMenu(null);
  };

  const handleArchiveChat = async (chat) => {
    try {
      const res = await api.post(`/chat/archive/${chat._id}`);
      const isArchived = res.data.isArchived;

      setChats((prev) => {
        const exists = prev.some((c) => c._id === chat._id);
        if (exists) {
          return prev.map((c) =>
            c._id === chat._id
              ? { ...c, archivedBy: isArchived ? [{ user: currentUserId, archivedAt: new Date() }] : [] }
              : c
          );
        } else if (!isArchived) {
          return [{ ...chat, archivedBy: [] }, ...prev];
        }
        return prev;
      });

      toast.success(isArchived ? "Chat archived successfully" : "Chat unarchived successfully");
    } catch (err) {
      console.error("Failed to archive chat:", err);
      toast.error("Failed to toggle archive state");
    }
    setContextMenu(null);
  };

  const handleLockUnlockClick = (chat, actionType) => {
    setContextMenu(null);
    setPasscodeValue("");
    setPasscodePrompt({ type: actionType, chat });
  };

  const handleToggleMarkUnread = async (chat) => {
    try {
      const res = await api.post(`/chat/mark-unread/${chat._id}`);
      const isMarkedUnread = res.data.isMarkedUnread;

      setChats((prev) =>
        prev.map((c) =>
          c._id === chat._id
            ? { ...c, markedUnreadBy: isMarkedUnread ? [{ user: currentUserId, markedAt: new Date() }] : [] }
            : c
        )
      );

      toast.success(isMarkedUnread ? "Chat marked as unread" : "Chat marked as read");
    } catch (err) {
      console.error("Mark unread error:", err);
      toast.error("Failed to toggle unread mark");
    }
    setContextMenu(null);
  };

  const handleToggleBlockUser = async (chat) => {
    const otherUser = chat.participants.find(p => p._id !== currentUserId);
    if (!otherUser) return;

    const isCurrentlyBlocked = currentUser.blockedUsers?.some(id => id.toString() === otherUser._id.toString());

    try {
      if (isCurrentlyBlocked) {
        await api.post(`/user/unblock/${otherUser._id}`);
        setCurrentUser(prev => ({
          ...prev,
          blockedUsers: (prev.blockedUsers || []).filter(id => id.toString() !== otherUser._id.toString())
        }));
        toast.success(`Unblocked ${otherUser.username}`);
      } else {
        await api.post(`/user/block/${otherUser._id}`);
        setCurrentUser(prev => ({
          ...prev,
          blockedUsers: [...(prev.blockedUsers || []), otherUser._id]
        }));
        toast.success(`Blocked ${otherUser.username}`);
      }
    } catch (err) {
      console.error("Toggle block error:", err);
      toast.error("Failed to update block status");
    }
    setContextMenu(null);
  };

  const handleDeleteChat = async (chat) => {
    const targetName = chat.isGroupChat
      ? chat.chatName
      : chat.participants.find((p) => p._id !== currentUserId)?.username || "User";
    const confirmed = await premiumConfirm(
      "Delete Chat?",
      `Are you sure you want to delete this chat with "${targetName}"? This will remove the chat from your list and hide all messages for you. Other participants will not be affected.`,
      "warning"
    );
    if (confirmed) {
      try {
        const chatId = chat._id;
        await api.delete(`/chat/${chatId}`);
        setChats((prev) => prev.filter((c) => c._id !== chatId));
        if (selectedUser?.chatId === chatId) {
          setSelectedUser(null);
        }
        toast.success("Chat deleted successfully");
      } catch (err) {
        console.error("Failed to delete chat:", err);
        toast.error("Failed to delete chat");
      }
    }
    setContextMenu(null);
  };

  const handleClearChat = async (chat) => {
    const confirmed = await premiumConfirm(
      "Clear Chat?",
      "Are you sure you want to clear all message history in this chat? This action will permanently clear all messages for you. Other participants will not be affected.",
      "warning"
    );
    if (confirmed) {
      try {
        const chatId = chat._id;
        await api.post(`/chat/clear/${chatId}`);
        window.dispatchEvent(new CustomEvent("chat-cleared", { detail: { chatId } }));
        toast.success("Chat history cleared successfully");
      } catch (err) {
        console.error("Failed to clear chat:", err);
        toast.error("Failed to clear chat");
      }
    }
    setContextMenu(null);
  };

  const handleVerifyPasscode = async () => {
    if (!passcodePrompt || passcodeValue.length < 4) {
      toast.error("Please enter a 4-digit passcode");
      return;
    }

    const { type, chat } = passcodePrompt;
    try {
      if (type === "lock") {
        await api.post(`/chat/lock/${chat._id}`, { passcode: passcodeValue });
        sessionStorage.setItem(`lock_passcode_${chat._id}`, passcodeValue);

        setChats((prev) =>
          prev.map((c) =>
            c._id === chat._id
              ? { ...c, lockedBy: [{ user: currentUserId, passcodeHash: "hidden" }] }
              : c
          )
        );

        toast.success("Chat locked successfully");
      } else if (type === "unlock") {
        await api.post(`/chat/unlock/${chat._id}`, { passcode: passcodeValue });
        sessionStorage.removeItem(`lock_passcode_${chat._id}`);

        setChats((prev) =>
          prev.map((c) =>
            c._id === chat._id
              ? { ...c, lockedBy: [] }
              : c
          )
        );

        toast.success("Chat unlocked successfully");
      } else if (type === "unlock-folder") {
        const firstLockedChat = chats.find(c => c.lockedBy?.some(l => l.user.toString() === currentUserId));
        if (firstLockedChat) {
          try {
            await api.get(`/message/${firstLockedChat._id}`, {
              headers: { "x-lock-passcode": passcodeValue }
            });
            chats.forEach(c => {
              if (c.lockedBy?.some(l => l.user.toString() === currentUserId)) {
                sessionStorage.setItem(`lock_passcode_${c._id}`, passcodeValue);
              }
            });
          } catch {
            premiumAlert("Access Denied", "Incorrect security PIN", "error");
            return;
          }
        }
        
        setShowLockedOnly(true);
        toast.success("Folder unlocked successfully!");
      }
    } catch (err) {
      console.error("Passcode verification failed:", err);
      premiumAlert("Access Denied", err.response?.data?.message || "Incorrect passcode", "error");
    } finally {
      setPasscodePrompt(null);
      setPasscodeValue("");
    }
  };

  /* =========================
     GLOBAL USER SEARCH (START NEW CHAT)
  ========================== */
  useEffect(() => {
    if (!search.trim()) {
      const t = setTimeout(() => setGlobalUsers([]), 0);
      return () => clearTimeout(t);
    }

    const delayDebounce = setTimeout(async () => {
      try {
        const res = await api.get(`/user/search?query=${encodeURIComponent(search)}`);
        setGlobalUsers(res.data || []);
      } catch (err) {
        console.error("Global search error:", err);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [search]);

  // Filter global users to exclude the current user and users who already have an active chat
  const filteredGlobalUsers = useMemo(() => {
    const activeChatUserIds = new Set(
      chats
        .filter((c) => !c.isGroupChat)
        .flatMap((c) => c.participants.map((p) => p._id))
    );

    return globalUsers.filter(
      (u) => u._id !== currentUserId && !activeChatUserIds.has(u._id)
    );
  }, [globalUsers, chats, currentUserId]);

  /* =========================
     OPEN CHAT
  ========================== */
  const handleOpenChat = async (chat) => {
    try {
      setLoadingChat(true);

      if (chat.isGroupChat) {
        setSelectedUser({
          _id: chat._id,
          username: chat.chatName,
          avatar: chat.groupAvatar,
          chatId: chat._id,
          isGroupChat: true,
          fullChat: chat,
        });
      } else {
        const otherUser = chat.participants.find((u) => u._id !== currentUserId);
        setSelectedUser({
          ...otherUser,
          chatId: chat._id,
          isGroupChat: false,
          fullChat: chat,
        });
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoadingChat(false);
    }
  };

  /* =========================
     START DM WITH NEW USER
  ========================== */
  const handleOpenGlobalUserChat = async (user) => {
    try {
      setLoadingChat(true);
      const res = await api.post("/chat", { userId: user._id });
      const newOrExistingChat = res.data;

      // Add to sidebar chats list if not already there
      if (!chats.some((c) => c._id === newOrExistingChat._id)) {
        setChats((prev) => [newOrExistingChat, ...prev]);
      }

      handleOpenChat(newOrExistingChat);
      setSearch(""); // clear search bar after opening chat
    } catch (err) {
      console.error("Failed to access or create chat:", err);
    } finally {
      setLoadingChat(false);
    }
  };

  const handleGroupCreated = (newGroup) => {
    setChats((prev) => [newGroup, ...prev]);
    handleOpenChat(newGroup);
  };

  return (
    <div className="flex w-full bg-app-sidebar text-app-text-primary h-full relative border-r border-app-border">
      
      {/* LEFT NAVIGATION RAIL (SLIM DOCK) */}
      <div className="w-[60px] bg-app-sidebar-rail border-r border-app-border flex flex-col justify-between items-center py-4.5 shrink-0 select-none">
        
        {/* Top Rail Items */}
        <div className="flex flex-col items-center gap-6 w-full">
          <div
            onClick={() => setShowProfile(true)}
            className={`w-10 h-10 rounded-full bg-brand flex items-center justify-center overflow-hidden cursor-pointer hover:scale-105 transition-all shadow-md relative group border-2 ${
              showProfile ? "border-app-text-primary scale-105" : "border-app-border"
            }`}
            title="Profile Settings"
          >
            {currentUser.avatar && !imgError ? (
              <img 
                src={currentUser.avatar} 
                alt="Profile" 
                className="w-full h-full object-cover" 
                onError={() => setImgError(true)}
              />
            ) : (
              <span className="text-white font-bold text-sm">
                {currentUser.username?.charAt(0).toUpperCase() || "?"}
              </span>
            )}
          </div>

          <div className="w-8 h-[1px] bg-app-border/60 my-0.5" />

          {/* Tab Navigation Icons */}
          <div className="flex flex-col gap-3.5 w-full items-center">
            {/* Chats Tab */}
            <button
              onClick={() => {
                setActiveTab("chats");
                setShowArchivedOnly(false);
                setShowLockedOnly(false);
              }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center relative transition-all duration-200 cursor-pointer ${
                activeTab === "chats" && !showArchivedOnly && !showLockedOnly
                  ? "text-app-text-primary dark:text-white bg-app-hover/40 scale-105"
                  : "text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover/40"
              }`}
              title="Chats"
            >
              <MessageSquare size={20} />
              {totalPrivateUnreads > 0 && (
                <span className="absolute top-1.5 right-1.5 bg-brand text-white text-[8px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full shadow shadow-brand/30 animate-pulse">
                  {totalPrivateUnreads > 99 ? "99+" : totalPrivateUnreads}
                </span>
              )}
            </button>

            {/* Groups Tab */}
            <button
              onClick={() => {
                setActiveTab("groups");
                setShowArchivedOnly(false);
                setShowLockedOnly(false);
              }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center relative transition-all duration-200 cursor-pointer ${
                activeTab === "groups" && !showArchivedOnly && !showLockedOnly
                  ? "text-app-text-primary dark:text-white bg-app-hover/40 scale-105"
                  : "text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover/40"
              }`}
              title="Groups"
            >
              <Users size={20} />
              {totalGroupUnreads > 0 && (
                <span className="absolute top-1.5 right-1.5 bg-brand text-white text-[8px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full shadow shadow-brand/30 animate-pulse">
                  {totalGroupUnreads > 99 ? "99+" : totalGroupUnreads}
                </span>
              )}
            </button>

            {/* AI Assistant Tab */}
            <button
              onClick={() => {
                setActiveTab("ai");
                setShowArchivedOnly(false);
                setShowLockedOnly(false);
              }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center relative transition-all duration-200 cursor-pointer ${
                activeTab === "ai" && !showArchivedOnly
                  ? "text-app-text-primary dark:text-white bg-app-hover/40 scale-105"
                  : "text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover/40"
              }`}
              title="AI Assistant"
            >
              <Sparkles size={20} />
            </button>

            {/* Archived Tab (Conditional) */}
            {archivedChatsCount > 0 && (
              <button
                onClick={() => {
                  setShowArchivedOnly(true);
                  setShowLockedOnly(false);
                }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center relative transition-all duration-200 cursor-pointer ${
                  showArchivedOnly
                    ? "text-app-text-primary dark:text-white bg-app-hover/40 scale-105"
                    : "text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover/40"
                }`}
                title="Archived Chats"
              >
                <Archive size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Bottom Rail Items */}
        <div className="flex flex-col items-center gap-4 w-full">
          {/* Quick Action: New Group */}
          <button
            onClick={() => setShowCreateGroup(true)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${
              showCreateGroup
                ? "text-app-text-primary dark:text-white bg-app-hover/40 scale-105"
                : "text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover/40"
            }`}
            title="New Group Chat"
          >
            <UserPlus size={18} />
          </button>

          {/* Call Logs Tab */}
          <button
            onClick={() => {
              setUnseenMissedCalls(0);
              setShowCalls(true);
            }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 relative cursor-pointer ${
              showCalls
                ? "text-app-text-primary dark:text-white bg-app-hover/40 scale-105"
                : "text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover/40"
            }`}
            title="Call Logs"
          >
            <Phone size={18} />
            {unseenMissedCalls > 0 && (
              <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[8px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full shadow shadow-red-500/30 animate-pulse">
                {unseenMissedCalls}
              </span>
            )}
          </button>

          {/* Follow Requests Tab */}
          <button
            onClick={() => setShowFollowRequests(true)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 relative cursor-pointer ${
              showFollowRequests
                ? "text-app-text-primary dark:text-white bg-app-hover/40 scale-105"
                : "text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover/40"
            }`}
            title="Follow Requests"
          >
            <UserCheck size={18} />
            {requestCount > 0 && (
              <span className="absolute top-1.5 right-1.5 bg-brand text-white text-[8px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full shadow shadow-brand/30 animate-pulse">
                {requestCount}
              </span>
            )}
          </button>

          <div className="w-8 h-[1px] bg-app-border/60 my-0.5" />

          {/* Quick Theme Toggle */}
          <button
            onClick={() => updateAppearance({ themeMode: theme === "dark" ? "light" : "dark" })}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover/40 transition-all duration-200 cursor-pointer"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Settings Tab */}
          <button
            onClick={() => setShowSettings(true)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${
              showSettings
                ? "text-app-text-primary dark:text-white bg-app-hover/40 scale-105"
                : "text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover/40"
            }`}
            title="Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* RIGHT CONTENT PANE */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-app-sidebar">
        
        {/* Pane Header */}
        <div className="pt-5 px-4 pb-1.5 flex items-center justify-between select-none">
          <h1 className="text-xl font-bold tracking-tight text-app-text-primary">
            {showArchivedOnly ? "Archived" : showLockedOnly ? "Locked" : activeTab === "chats" ? "Chats" : activeTab === "groups" ? "Groups" : "AI Assistant"}
          </h1>
          {activeTab === "ai" && (
            <button
              onClick={handleCreateAiConversation}
              className="flex items-center gap-1 px-2.5 py-1 bg-brand text-white rounded-lg text-xs font-semibold hover:opacity-90 transition shadow-sm cursor-pointer animate-fade-in"
              title="New AI Conversation"
            >
              <Plus size={12} />
              <span>New Chat</span>
            </button>
          )}
        </div>

        {/* SEARCH */}
        <div className="p-3 pb-2.5 bg-app-sidebar shrink-0">
          <div className="bg-app-input rounded-xl flex items-center px-3 border border-app-border focus-within:border-brand/40 transition-colors shadow-sm">
            <Search size={18} className="text-app-text-secondary shrink-0" />
            <input
              type="text"
              placeholder={activeTab === "chats" ? "Search chats or start new..." : activeTab === "groups" ? "Search groups..." : "Search AI chats..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent outline-none px-3 py-2.5 text-sm text-app-text-primary placeholder-app-text-secondary/60"
            />
          </div>
        </div>

        {/* CHAT LIST */}
      <div className="flex-1 overflow-y-auto chat-list-container">
        {/* FOLDER BACK HEADER */}
        {showArchivedOnly && (
          <div
            onClick={() => setShowArchivedOnly(false)}
            className="flex items-center gap-3 px-4 py-3 bg-app-header border-b border-app-border cursor-pointer text-app-text-primary font-semibold text-sm hover:bg-app-hover select-none transition-colors"
          >
            <ArrowLeft size={16} className="text-app-text-secondary" />
            <span>Archived Chats</span>
          </div>
        )}

        {showLockedOnly && (
          <div
            onClick={() => setShowLockedOnly(false)}
            className="flex items-center gap-3 px-4 py-3 bg-app-header border-b border-app-border cursor-pointer text-app-text-primary font-semibold text-sm hover:bg-app-hover select-none transition-colors"
          >
            <ArrowLeft size={16} className="text-app-text-secondary" />
            <span>Locked Chats</span>
          </div>
        )}

        {/* STATIC FOLDER SHORTCUTS IN MAIN VIEW */}
        {activeTab !== "ai" && !showArchivedOnly && !showLockedOnly && search.trim() === "" && (
          <>


            {lockedChatsCount > 0 && (
              <div
                onClick={() => setPasscodePrompt({ type: "unlock-folder" })}
                className="flex items-center justify-between px-4 py-3 bg-app-sidebar hover:bg-app-hover cursor-pointer transition border-b border-app-border select-none"
              >
                <div className="flex items-center gap-3 text-app-text-primary">
                  <Lock size={18} className="text-brand" />
                  <span className="font-semibold text-sm">Locked Chats</span>
                </div>
                <span className="text-xs text-brand font-semibold">Protected</span>
              </div>
            )}
          </>
        )}

        {/* Active Chats Category */}
        {activeTab !== "ai" && search.trim() !== "" && filteredChats.length > 0 && (
          <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-brand bg-app-sidebar border-b border-app-border">
            Active Chats
          </div>
        )}

        {activeTab !== "ai" && chatsToRender.map((chat) => {
          let userObj = {};

          if (chat.isGroupChat) {
            userObj = {
              _id: chat._id,
              username: chat.chatName,
              avatar: chat.groupAvatar,
              latestMessage: chat.lastMessage,
              isGroupChat: true,
            };
          } else {
            const otherUser = chat.participants.find((u) => u._id !== currentUserId);
            userObj = {
              ...otherUser,
              latestMessage: chat.lastMessage,
              isGroupChat: false,
            };
          }

          // Unread Count
          const unreadCount = unreadCounts?.[chat._id] || 0;
          const hasManualUnread = chat.markedUnreadBy?.some(u => u.user.toString() === currentUserId);

          // Typing status
          const isTyping = typingUsers?.[chat._id];

          // Online status
          const isOnline = !chat.isGroupChat && onlineUsers?.some(id => id?.toString() === userObj?._id?.toString() || id?.toString() === userObj?.id?.toString());

          const isPinned = chat.pinnedBy?.some(p => p.user.toString() === currentUserId) || pinnedChatIds.includes(chat._id);
          const isLocked = chat.lockedBy?.some(l => l.user.toString() === currentUserId);

          return (
            <div
              key={chat._id}
              onContextMenu={(e) => handleContextMenu(e, chat)}
              className="relative group transition-all"
            >
              <ConversationItem
                user={userObj}
                unreadCount={unreadCount}
                isMarkedUnread={hasManualUnread}
                isTyping={isTyping}
                isOnline={isOnline}
                isActive={selectedUser?.chatId === chat._id}
                onClick={() => handleOpenChat(chat)}
              />
              <div className="absolute right-4 top-2.5 flex items-center gap-1.5 select-none">
                {isPinned && <Pin size={13} className="text-brand rotate-45" title="Pinned Chat" />}
                {isLocked && <Lock size={13} className="text-amber-500" title="Locked Chat" />}
              </div>
            </div>
          );
        })}

        {/* Global Users / Start New Chat Category */}
        {activeTab !== "ai" && search.trim() !== "" && filteredGlobalUsers.length > 0 && (
          <div className="px-4 py-2 mt-3 text-[10px] font-bold uppercase tracking-wider text-brand bg-app-sidebar border-t border-app-border">
            Start a New Chat
          </div>
        )}

        {activeTab !== "ai" && search.trim() !== "" && filteredGlobalUsers.map((user) => (
          <ConversationItem
            key={user._id}
            user={{
              ...user,
              latestMessage: null,
              isGroupChat: false,
            }}
            unreadCount={0}
            isTyping={false}
            isOnline={onlineUsers?.some(id => id?.toString() === user?._id?.toString() || id?.toString() === user?.id?.toString())}
            isActive={selectedUser?._id === user._id && !selectedUser?.isGroupChat}
            onClick={() => handleOpenGlobalUserChat(user)}
          />
        ))}

        {/* Empty States */}
        {activeTab !== "ai" && chatsToRender.length === 0 && (
          <div className="text-center text-gray-400 py-8 text-xs select-none">
            {showArchivedOnly
              ? "No archived chats."
              : showLockedOnly
              ? "No locked chats."
              : "No active chats."}
          </div>
        )}

        {/* AI Conversations List */}
        {activeTab === "ai" && (
          <div className="flex flex-col h-full">
            {/* NEW CHAT BUTTON */}
            <button
              onClick={handleCreateAiConversation}
              className="mx-4 my-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand/90 text-white font-semibold text-xs rounded-xl transition cursor-pointer select-none shadow-sm shrink-0 border border-transparent"
            >
              <Plus size={14} />
              <span>New AI Chat</span>
            </button>

            {/* LIST */}
            <div className="flex-1 overflow-y-auto space-y-0.5 select-none">
              {filteredAiConversations.map((c) => {
                const isActive = selectedUser?.isAiChat && selectedUser._id === c._id;
                const isEditing = editingAiId === c._id;

                return (
                  <div
                    key={c._id}
                    onClick={() => !isEditing && handleOpenAiConversation(c)}
                    className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none transition group relative ${
                      isActive ? "bg-app-active" : "hover:bg-app-hover/50"
                    }`}
                  >
                    {/* Left icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                      isActive 
                        ? "bg-brand/20 border-brand/30 text-brand" 
                        : "bg-app-input border-app-border text-app-text-secondary"
                    }`}>
                      <Sparkles size={16} />
                    </div>

                    {/* Middle Content */}
                    <div className="flex-1 min-w-0 flex flex-col text-left">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveRename(c._id);
                              if (e.key === "Escape") setEditingAiId(null);
                            }}
                            autoFocus
                            className="w-full bg-app-input text-xs text-app-text-primary outline-none px-2 py-1 rounded border border-brand"
                          />
                          <button
                            onClick={() => handleSaveRename(c._id)}
                            className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                          >
                            <CheckCheck size={14} />
                          </button>
                          <button
                            onClick={() => setEditingAiId(null)}
                            className="p-1 text-red-400 hover:text-red-300 cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="font-semibold text-sm text-app-text-primary truncate">
                            {c.title}
                          </span>
                          <span className="text-[10px] text-app-text-secondary mt-0.5 truncate font-mono uppercase tracking-wider">
                            {c.model}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Action buttons (Visible on hover) */}
                    {!isEditing && (
                      <div className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pl-4 py-2 ${
                        isActive ? "bg-app-active" : "bg-app-sidebar group-hover:bg-app-hover/50"
                      }`}>
                        <button
                          onClick={(e) => handleStartRename(e, c)}
                          className="p-1.5 text-app-text-secondary hover:text-app-text-primary rounded-lg hover:bg-app-hover transition cursor-pointer"
                          title="Rename"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteAiConversation(e, c._id)}
                          className="p-1.5 text-red-500 hover:text-red-400 rounded-lg hover:bg-app-hover transition cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredAiConversations.length === 0 && (
                <div className="text-center text-app-text-secondary py-12 text-xs select-none">
                  No AI conversations found.
                </div>
              )}
            </div>
          </div>
        )}

        {/* LOADING */}
        {loadingChat && (
          <div className="text-center text-gray-400 py-3 text-xs">Opening chat...</div>
        )}
      </div>
    </div>

      {/* CREATE GROUP MODAL */}
      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onGroupCreated={handleGroupCreated}
        />
      )}

      {/* SETTINGS DRAWER */}
      {showSettings && (
        <SettingsDrawer
          onClose={() => setShowSettings(false)}
          currentUser={currentUser}
          onOpenProfile={() => setShowProfile(true)}
          onOpenChat={setSelectedUser}
        />
      )}

      {/* PROFILE SETTINGS DRAWER */}
      {showProfile && (
        <ProfileSettingsDrawer 
          onClose={() => setShowProfile(false)} 
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
        />
      )}

      {/* FLOATING CUSTOM CONTEXT MENU */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-app-card/95 backdrop-blur-md border border-app-border/80 rounded-xl p-1 shadow-2xl w-48 transition-all duration-100 ease-out select-none"
          style={{
            top: `${Math.min(contextMenu.y, window.innerHeight - 270)}px`,
            left: `${Math.min(contextMenu.x, window.innerWidth - 200)}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Section 1: General Actions */}
          <div className="space-y-0.5">
            {/* Pin / Unpin Chat */}
            {(() => {
              const isPinned = contextMenu.chat.pinnedBy?.some(p => p.user.toString() === currentUserId) || pinnedChatIds.includes(contextMenu.chat._id);
              return (
                <button
                  onClick={() => handlePinChat(contextMenu.chat)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-app-hover transition-colors flex items-center gap-2.5 text-app-text-primary cursor-pointer"
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-md shrink-0 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    {isPinned ? <PinOff size={13} /> : <Pin size={13} className="rotate-45" />}
                  </div>
                  <span className="font-medium text-xs">
                    {isPinned ? "Unpin Chat" : "Pin Chat"}
                  </span>
                </button>
              );
            })()}

            {/* Archive / Unarchive Chat */}
            {(() => {
              const isArchived = contextMenu.chat.archivedBy?.some(a => a.user.toString() === currentUserId);
              return (
                <button
                  onClick={() => handleArchiveChat(contextMenu.chat)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-app-hover transition-colors flex items-center gap-2.5 text-app-text-primary cursor-pointer"
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-md shrink-0 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    {isArchived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                  </div>
                  <span className="font-medium text-xs">
                    {isArchived ? "Unarchive Chat" : "Archive Chat"}
                  </span>
                </button>
              );
            })()}

            {/* Lock / Unlock Chat */}
            {(() => {
              const isLocked = contextMenu.chat.lockedBy?.some(l => l.user.toString() === currentUserId);
              return (
                <button
                  onClick={() => handleLockUnlockClick(contextMenu.chat, isLocked ? "unlock" : "lock")}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-app-hover transition-colors flex items-center gap-2.5 text-app-text-primary cursor-pointer"
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-md shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    {isLocked ? <Unlock size={13} /> : <Lock size={13} />}
                  </div>
                  <span className="font-medium text-xs">
                    {isLocked ? "Unlock Chat" : "Lock Chat"}
                  </span>
                </button>
              );
            })()}

            {/* Mark as Read / Unread */}
            {(() => {
              const isMarkedUnread = contextMenu.chat.markedUnreadBy?.some(u => u.user.toString() === currentUserId);
              return (
                <button
                  onClick={() => handleToggleMarkUnread(contextMenu.chat)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-app-hover transition-colors flex items-center gap-2.5 text-app-text-primary cursor-pointer"
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-md shrink-0 bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    {isMarkedUnread ? <MailOpen size={13} /> : <Mail size={13} />}
                  </div>
                  <span className="font-medium text-xs">
                    {isMarkedUnread ? "Mark as Read" : "Mark as Unread"}
                  </span>
                </button>
              );
            })()}
          </div>

          {/* Section 2: Block / Unblock User (1-to-1 only) */}
          {!contextMenu.chat.isGroupChat && (() => {
            const otherUser = contextMenu.chat.participants.find((p) => p._id !== currentUserId);
            const isBlocked = currentUser.blockedUsers?.some(
              (id) => id.toString() === otherUser?._id.toString()
            );
            return (
              <div className="border-t border-app-border/40 my-0.5 pt-0.5 space-y-0.5">
                <button
                  onClick={() => handleToggleBlockUser(contextMenu.chat)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-app-hover transition-colors flex items-center gap-2.5 text-app-text-primary cursor-pointer"
                >
                  <div className={`flex items-center justify-center w-6 h-6 rounded-md shrink-0 ${isBlocked ? "bg-teal-500/10 text-teal-600 dark:text-teal-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"}`}>
                    {isBlocked ? <UserCheck size={13} /> : <UserX size={13} />}
                  </div>
                  <span className="font-medium text-xs">
                    {isBlocked ? "Unblock User" : "Block User"}
                  </span>
                </button>
              </div>
            );
          })()}

          {/* Section 3: Destructive Actions */}
          <div className="border-t border-app-border/40 my-0.5 pt-0.5 space-y-0.5">
            {/* Clear Chat */}
            <button
              onClick={() => {
                setContextMenu(null);
                handleClearChat(contextMenu.chat);
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-app-hover transition-colors flex items-center gap-2.5 text-app-text-primary cursor-pointer"
            >
              <div className="flex items-center justify-center w-6 h-6 rounded-md shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Eraser size={13} />
              </div>
              <span className="font-medium text-xs">Clear Chat</span>
            </button>

            {/* Delete Chat */}
            <button
              onClick={() => {
                setContextMenu(null);
                handleDeleteChat(contextMenu.chat);
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-500/5 hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center gap-2.5 text-red-500 dark:text-red-400 cursor-pointer"
            >
              <div className="flex items-center justify-center w-6 h-6 rounded-md shrink-0 bg-red-500/10 text-red-600 dark:text-red-400">
                <Trash2 size={13} />
              </div>
              <span className="font-semibold text-xs">Delete Chat</span>
            </button>
          </div>
        </div>
      )}

      {/* SECURE PASSCODE PIN MODAL */}
      {passcodePrompt && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-app-card/95 backdrop-blur-xl border border-app-border/80 rounded-3xl w-[90%] max-w-sm p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] text-center flex flex-col items-center">
            {/* Animated Ring Lock Icon Container */}
            <div className="w-14 h-14 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand mb-4 ring-8 ring-brand/5 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
              <Lock size={22} className="text-brand animate-pulse" />
            </div>

            <h3 className="text-lg font-bold text-app-text-primary mt-1 mb-2 tracking-tight">
              {passcodePrompt.type === "lock"
                ? "Set Chat Lock Passcode"
                : passcodePrompt.type === "unlock"
                ? "Unlock Locked Chat"
                : "Unlock Locked Chats Folder"}
            </h3>
            <p className="text-xs text-app-text-secondary mb-6 leading-relaxed max-w-[250px]">
              {passcodePrompt.type === "lock"
                ? "Create a 4-digit security PIN to restrict access to this conversation."
                : "Enter your 4-digit security PIN to continue."}
            </p>
            
            {/* Hidden Input to capture user typing */}
            <input
              id="passcode-hidden-input"
              type="password"
              maxLength={4}
              value={passcodeValue}
              onChange={(e) => setPasscodeValue(e.target.value.replace(/\D/g, ""))}
              className="opacity-0 absolute pointer-events-none w-0 h-0"
              autoFocus
            />

            {/* Visual 4-Digit Passcode Display */}
            <div 
              className="flex justify-center gap-3.5 mb-8 cursor-pointer select-none" 
              onClick={() => document.getElementById("passcode-hidden-input")?.focus()}
            >
              {[0, 1, 2, 3].map((index) => {
                const char = passcodeValue[index];
                const isActive = passcodeValue.length === index;
                return (
                  <div
                    key={index}
                    className={`w-12 h-14 rounded-xl border flex items-center justify-center text-2xl font-bold transition-all duration-200 ${
                      char
                        ? "border-brand text-brand bg-brand/5 shadow-[0_0_12px_rgba(99,102,241,0.15)]"
                        : isActive
                        ? "border-brand/80 bg-app-input scale-105 shadow-[0_0_8px_rgba(99,102,241,0.1)]"
                        : "border-app-border bg-app-input"
                    }`}
                  >
                    {char ? "•" : ""}
                  </div>
                );
              })}
            </div>
            
            <div className="flex justify-center gap-3 w-full">
              <button
                onClick={() => {
                  setPasscodePrompt(null);
                  setPasscodeValue("");
                }}
                className="flex-1 py-2.5 rounded-xl bg-transparent border border-app-border text-app-text-primary hover:bg-app-hover transition-all text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyPasscode}
                className="flex-1 py-2.5 rounded-xl bg-brand hover:bg-brand/80 text-white font-bold transition-all text-xs shadow-lg shadow-brand/10 cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showFollowRequests && (
        <FollowRequestsDrawer 
          onClose={() => {
            setShowFollowRequests(false);
            fetchRequestCount();
          }} 
          onRequestCountChange={(cnt) => setRequestCount(cnt)}
        />
      )}

      {showCalls && (
        <CallsDrawer 
          onClose={() => setShowCalls(false)} 
        />
      )}
    </div>
  );
}

export default Sidebar;
