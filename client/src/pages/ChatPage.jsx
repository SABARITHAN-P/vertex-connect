import { useState, useEffect, useRef } from "react";
import { socket } from "@socket/socket";
import api from "@services/api";
import Sidebar from "@components/features/chat/Sidebar";
import ChatWindow from "@components/features/chat/ChatWindow";
import AiAssistantWindow from "@components/features/ai/AiAssistantWindow";
import UserProfileModal from "@components/features/social/UserProfileModal";
import CallOverlay from "@components/features/calls/CallOverlay";
import { useTheme } from "@context/ThemeContext";

function ChatPage() {
  const { fetchAppearance } = useTheme();
  const [selectedUser, setSelectedUser] = useState(null);

  /* CHATS */
  const [chats, setChats] = useState([]);

  /* UNREAD COUNTS */
  const [unreadCounts, setUnreadCounts] = useState({});

  /* ONLINE USERS */
  const [onlineUsers, setOnlineUsers] = useState([]);

  /* LAST SEEN USERS */
  const [lastSeenUsers, setLastSeenUsers] = useState({});

  /* TYPING USERS */
  const [typingUsers, setTypingUsers] = useState({});

  /* VIEWING USER PROFILE MODAL */
  const [viewingUserProfile, setViewingUserProfile] = useState(null);

  const [currentUser, setCurrentUser] = useState(() => JSON.parse(localStorage.getItem("userInfo")) || {});
  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);
  const [archivedChats, setArchivedChats] = useState([]);
  const [lockedChats, setLockedChats] = useState([]);

  // Fetch folders dynamically in parent page
  useEffect(() => {
    if (currentUser && (currentUser._id || currentUser.id)) {
      api.get("/chat?archived=true")
        .then((res) => setArchivedChats(res.data || []))
        .catch((err) => console.error("Failed to fetch archived chats in page:", err));

      api.get("/chat?locked=true")
        .then((res) => setLockedChats(res.data || []))
        .catch((err) => console.error("Failed to fetch locked chats in page:", err));
    }
  }, [currentUser]);

  useEffect(() => {
    const handleViewProfile = (e) => {
      setViewingUserProfile(e.detail);
    };
    window.addEventListener("view-user-profile", handleViewProfile);
    return () => window.removeEventListener("view-user-profile", handleViewProfile);
  }, []);

  /* =========================
     SOCKET SETUP
  ========================== */
  useEffect(() => {
    const fetchChatsAndProfile = async () => {
      try {
        const { data: profileData } = await api.get("/auth/profile");
        const userInfoLocal = JSON.parse(localStorage.getItem("userInfo")) || {};
        const updatedUser = { ...userInfoLocal, ...profileData };
        localStorage.setItem("userInfo", JSON.stringify(updatedUser));
        setCurrentUser(updatedUser);
      } catch (error) {
        console.error("Failed to fetch user profile:", error);
      }

      try {
        const { data } = await api.get("/chat");
        setChats(data);

        // Initialize unread counts map for Sidebar using database values (always keyed by chatId)
        const initialUnreads = {};
        data.forEach((c) => {
          initialUnreads[c._id] = c.unreadCount || 0;
        });
        setUnreadCounts(initialUnreads);
      } catch (error) {
        console.log(error);
      }

      fetchAppearance();
    };
    fetchChatsAndProfile();
  }, [fetchAppearance]);

  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem("userInfo"));

    /* USER SETUP */
    const setupUser = () => {
      if (userInfo) {
        socket.emit("setup", userInfo);
      }
    };

    setupUser();
    socket.on("connect", setupUser);

    /* =========================
       ONLINE USERS
    ========================== */
    const handleOnlineUsers = (users) => {
      setOnlineUsers(users);
    };

    const handleUserOnline = (data) => {
      setOnlineUsers((prev) => {
        if (prev.includes(data.userId)) return prev;
        return [...prev, data.userId];
      });

      setSelectedUser((prev) => {
        if (!prev || prev._id !== data.userId) {
          return prev;
        }
        return {
          ...prev,
          status: "online",
        };
      });
    };

    /* =========================
       USER OFFLINE
    ========================== */
    const handleUserOffline = (data) => {
      setOnlineUsers((prev) => prev.filter((id) => id !== data.userId));

      setLastSeenUsers((prev) => ({
        ...prev,
        [data.userId]: data.lastSeen,
      }));

      setSelectedUser((prev) => {
        if (!prev || prev._id !== data.userId) {
          return prev;
        }

        return {
          ...prev,
          status: "offline",
          lastSeen: data.lastSeen,
        };
      });
    };

    const handleUserLastSeenUpdated = (data) => {
      setLastSeenUsers((prev) => ({
        ...prev,
        [data.userId]: data.lastSeen,
      }));

      setSelectedUser((prev) => {
        if (!prev || prev._id !== data.userId) {
          return prev;
        }
        return {
          ...prev,
          lastSeen: data.lastSeen,
        };
      });
    };

    /* =========================
       TYPING
    ========================== */
    const handleTyping = (data) => {
      setTypingUsers((prev) => ({
        ...prev,
        [data.chatId]: {
          username: data.senderName,
          avatar: data.senderAvatar
        }
      }));
    };

    const handleStopTyping = (data) => {
      setTypingUsers((prev) => {
        const newState = { ...prev };
        delete newState[data.chatId];
        return newState;
      });
    };

    const handleGroupCreated = (newGroup) => {
      setChats((prev) => {
        if (prev.some((c) => c._id === newGroup._id)) return prev;
        return [newGroup, ...prev];
      });
    };

    const handleGroupRemoved = (data) => {
      setChats((prev) => prev.filter((c) => c._id !== data.chatId));
      setSelectedUser((prev) => (prev?.chatId === data.chatId ? null : prev));
    };

    const handleUserProfileUpdated = (data) => {
      // Update local storage if it's the current user
      const localUser = JSON.parse(localStorage.getItem("userInfo"));
      if (localUser && (localUser._id === data.userId || localUser.id === data.userId)) {
        localUser.username = data.username;
        localUser.avatar = data.avatar;
        localUser.about = data.about || data.status;
        localUser.status = data.status;
        localStorage.setItem("userInfo", JSON.stringify(localUser));
        setCurrentUser(localUser);
      }

      setChats((prev) =>
        prev.map((c) => {
          const updatedParticipants = c.participants?.map((p) => {
            if (p._id === data.userId) {
              return { ...p, username: data.username, avatar: data.avatar, about: data.about || data.status, status: data.status };
            }
            return p;
          });
          let updatedLastMessage = c.lastMessage;
          if (c.lastMessage && c.lastMessage.sender && (c.lastMessage.sender._id === data.userId || c.lastMessage.sender === data.userId)) {
            updatedLastMessage = {
              ...c.lastMessage,
              sender: {
                ...c.lastMessage.sender,
                username: data.username,
                avatar: data.avatar,
                about: data.about || data.status,
                status: data.status,
              },
            };
          }
          return {
            ...c,
            participants: updatedParticipants,
            lastMessage: updatedLastMessage,
          };
        })
      );

      setArchivedChats((prev) =>
        prev.map((c) => {
          const updatedParticipants = c.participants?.map((p) => {
            if (p._id === data.userId) {
              return { ...p, username: data.username, avatar: data.avatar, about: data.about || data.status, status: data.status };
            }
            return p;
          });
          let updatedLastMessage = c.lastMessage;
          if (c.lastMessage && c.lastMessage.sender && (c.lastMessage.sender._id === data.userId || c.lastMessage.sender === data.userId)) {
            updatedLastMessage = {
              ...c.lastMessage,
              sender: {
                ...c.lastMessage.sender,
                username: data.username,
                avatar: data.avatar,
                about: data.about || data.status,
                status: data.status,
              },
            };
          }
          return {
            ...c,
            participants: updatedParticipants,
            lastMessage: updatedLastMessage,
          };
        })
      );

      setLockedChats((prev) =>
        prev.map((c) => {
          const updatedParticipants = c.participants?.map((p) => {
            if (p._id === data.userId) {
              return { ...p, username: data.username, avatar: data.avatar, about: data.about || data.status, status: data.status };
            }
            return p;
          });
          let updatedLastMessage = c.lastMessage;
          if (c.lastMessage && c.lastMessage.sender && (c.lastMessage.sender._id === data.userId || c.lastMessage.sender === data.userId)) {
            updatedLastMessage = {
              ...c.lastMessage,
              sender: {
                ...c.lastMessage.sender,
                username: data.username,
                avatar: data.avatar,
                about: data.about || data.status,
                status: data.status,
              },
            };
          }
          return {
            ...c,
            participants: updatedParticipants,
            lastMessage: updatedLastMessage,
          };
        })
      );

      setSelectedUser((prev) => {
        if (!prev) return prev;
        if (!prev.isGroupChat && prev._id === data.userId) {
          return { ...prev, username: data.username, avatar: data.avatar, about: data.about || data.status, status: data.status };
        }
        if (prev.isGroupChat) {
          const updatedParticipants = prev.participants?.map((p) => {
            if (p._id === data.userId) {
              return { ...p, username: data.username, avatar: data.avatar, about: data.about || data.status, status: data.status };
            }
            return p;
          });
          return { ...prev, participants: updatedParticipants };
        }
        return prev;
      });

      // Synchronize currently active profile view modals in real time
      setViewingUserProfile((prev) => {
        if (prev && prev._id === data.userId) {
          return { ...prev, username: data.username, avatar: data.avatar, about: data.about || data.status, status: data.status };
        }
        return prev;
      });
    };

    const handleGroupProfileUpdated = (data) => {
      setChats((prev) =>
        prev.map((c) => {
          if (c._id === data.chatId) {
            return {
              ...c,
              groupAvatar: data.groupAvatar,
              chatName: data.chatName,
            };
          }
          return c;
        })
      );

      setSelectedUser((prev) => {
        if (prev && prev.chatId === data.chatId) {
          return {
            ...prev,
            groupAvatar: data.groupAvatar,
            chatName: data.chatName,
          };
        }
        return prev;
      });
    };

    const handleGlobalNewMessage = (newMessage) => {
      const incomingChatId = typeof newMessage.chat === "object" ? newMessage.chat._id : newMessage.chat;
      setChats((prev) => {
        const chatExists = prev.some((c) => c._id === incomingChatId);
        if (!chatExists) {
          api.get("/chat").then((res) => {
            if (res.data) setChats(res.data);
          }).catch((err) => console.error("Failed to restore chats:", err));
          return prev;
        }

        const updatedChats = prev.map((c) => {
          if (c._id === incomingChatId) {
            return { ...c, lastMessage: newMessage };
          }
          return c;
        });
        // Sort by lastMessage.createdAt
        updatedChats.sort((a, b) => {
          const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
          const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
          return timeB - timeA;
        });
        return updatedChats;
      });
    };

    const handleUnreadUpdated = (data) => {
      setUnreadCounts((prev) => ({
        ...prev,
        [data.chatId]: data.unreadCount,
      }));
    };

    const handleChatRead = (data) => {
      setUnreadCounts((prev) => ({
        ...prev,
        [data.chatId]: 0,
      }));
    };

    const handleChatDeleted = ({ chatId }) => {
      setChats((prev) => prev.filter((c) => c._id !== chatId));
      setSelectedUser((prev) => (prev?.chatId === chatId ? null : prev));
    };

    const handleChatCleared = ({ chatId }) => {
      window.dispatchEvent(new CustomEvent("chat-cleared", { detail: { chatId } }));
      setChats((prev) =>
        prev.map((c) =>
          c._id === chatId ? { ...c, lastMessage: null } : c
        )
      );
    };

    const handleChatArchived = async () => {
      try {
        const { data } = await api.get("/chat");
        setChats(data);
        api.get("/chat?archived=true").then((res) => setArchivedChats(res.data || [])).catch((err) => console.error(err));
        api.get("/chat?locked=true").then((res) => setLockedChats(res.data || [])).catch((err) => console.error(err));
      } catch (err) {
        console.error("Failed to fetch chats on archive toggle:", err);
      }
    };

    const handleChatPinned = ({ chatId, isPinned }) => {
      setChats((prev) =>
        prev.map((c) =>
          c._id === chatId
            ? { ...c, pinnedBy: isPinned ? [{ user: currentUserRef.current?._id || currentUserRef.current?.id }] : [] }
            : c
        )
      );
    };

    const handleChatLocked = ({ chatId, isLocked }) => {
      setChats((prev) =>
        prev.map((c) =>
          c._id === chatId
            ? { ...c, lockedBy: isLocked ? [{ user: currentUserRef.current?._id || currentUserRef.current?.id, passcodeHash: "hidden" }] : [] }
            : c
        )
      );
      api.get("/chat?archived=true").then((res) => setArchivedChats(res.data || [])).catch((err) => console.error(err));
      api.get("/chat?locked=true").then((res) => setLockedChats(res.data || [])).catch((err) => console.error(err));
    };

    const handleChatUnlocked = ({ chatId }) => {
      setChats((prev) =>
        prev.map((c) =>
          c._id === chatId
            ? { ...c, lockedBy: [] }
            : c
        )
      );
      api.get("/chat?archived=true").then((res) => setArchivedChats(res.data || [])).catch((err) => console.error(err));
      api.get("/chat?locked=true").then((res) => setLockedChats(res.data || [])).catch((err) => console.error(err));
    };

    const handleChatMarkedUnread = ({ chatId, isMarkedUnread }) => {
      setChats((prev) =>
        prev.map((c) =>
          c._id === chatId
            ? { ...c, markedUnreadBy: isMarkedUnread ? [{ user: currentUserRef.current?._id || currentUserRef.current?.id }] : [] }
            : c
        )
      );
    };

    const handleUserBlockedEvent = ({ blockerId, blockedId }) => {
      if (currentUserRef.current && (currentUserRef.current._id === blockerId || currentUserRef.current.id === blockerId)) {
        setCurrentUser((prev) => ({
          ...prev,
          blockedUsers: [...(prev.blockedUsers || []), blockedId]
        }));
      }
    };

    const handleUserUnblockedEvent = ({ blockerId, blockedId }) => {
      if (currentUserRef.current && (currentUserRef.current._id === blockerId || currentUserRef.current.id === blockerId)) {
        setCurrentUser((prev) => ({
          ...prev,
          blockedUsers: (prev.blockedUsers || []).filter(id => id.toString() !== blockedId.toString())
        }));
      }
    };

    /* SOCKET LISTENERS */
    socket.on("onlineUsers", handleOnlineUsers);
    socket.on("userOffline", handleUserOffline);
    socket.on("user:online", handleUserOnline);
    socket.on("user:offline", handleUserOffline);
    socket.on("user:last-seen-updated", handleUserLastSeenUpdated);
    socket.on("typing", handleTyping);
    socket.on("stopTyping", handleStopTyping);
    socket.on("group:typing-start", handleTyping);
    socket.on("group:typing-stop", handleStopTyping);
    socket.on("groupCreated", handleGroupCreated);
    socket.on("groupRemoved", handleGroupRemoved);
    socket.on("chat:deleted", handleChatDeleted);
    socket.on("group:deleted", handleChatDeleted);
    socket.on("chat:cleared", handleChatCleared);
    socket.on("user:profile-updated", handleUserProfileUpdated);
    socket.on("group:profile-updated", handleGroupProfileUpdated);
    socket.on("newMessage", handleGlobalNewMessage);
    socket.on("chat:unread-updated", handleUnreadUpdated);
    socket.on("group:unread-updated", handleUnreadUpdated);
    socket.on("chat:read", handleChatRead);
    socket.on("group:read", handleChatRead);
    socket.on("chat:archived", handleChatArchived);
    socket.on("chat:pinned", handleChatPinned);
    socket.on("chat:locked", handleChatLocked);
    socket.on("chat:unlocked", handleChatUnlocked);
    socket.on("chat:marked-unread", handleChatMarkedUnread);
    socket.on("user:blocked", handleUserBlockedEvent);
    socket.on("user:unblocked", handleUserUnblockedEvent);

    /* CLEANUP */
    return () => {
      socket.off("connect", setupUser);
      socket.off("onlineUsers", handleOnlineUsers);
      socket.off("userOffline", handleUserOffline);
      socket.off("user:online", handleUserOnline);
      socket.off("user:offline", handleUserOffline);
      socket.off("user:last-seen-updated", handleUserLastSeenUpdated);
      socket.off("typing", handleTyping);
      socket.off("stopTyping", handleStopTyping);
      socket.off("group:typing-start", handleTyping);
      socket.off("group:typing-stop", handleStopTyping);
      socket.off("groupCreated", handleGroupCreated);
      socket.off("groupRemoved", handleGroupRemoved);
      socket.off("chat:deleted", handleChatDeleted);
      socket.off("group:deleted", handleChatDeleted);
      socket.off("chat:cleared", handleChatCleared);
      socket.off("user:profile-updated", handleUserProfileUpdated);
      socket.off("group:profile-updated", handleGroupProfileUpdated);
      socket.off("newMessage", handleGlobalNewMessage);
      socket.off("chat:unread-updated", handleUnreadUpdated);
      socket.off("group:unread-updated", handleUnreadUpdated);
      socket.off("chat:read", handleChatRead);
      socket.off("group:read", handleChatRead);
      socket.off("chat:archived", handleChatArchived);
      socket.off("chat:pinned", handleChatPinned);
      socket.off("chat:locked", handleChatLocked);
      socket.off("chat:unlocked", handleChatUnlocked);
      socket.off("chat:marked-unread", handleChatMarkedUnread);
      socket.off("user:blocked", handleUserBlockedEvent);
      socket.off("user:unblocked", handleUserUnblockedEvent);
    };
  }, []);

  /* =========================
     JOIN CHAT ROOM
  ========================== */
  useEffect(() => {
    if (selectedUser?.chatId) {
      socket.emit("joinChat", selectedUser.chatId);
    }

    return () => {
      if (selectedUser?.chatId) {
        socket.emit("leaveChat", selectedUser.chatId);
      }
    };
  }, [selectedUser]);

  const handleStartDM = async (user) => {
    try {
      const res = await api.post("/chat", { userId: user._id });
      const newOrExistingChat = res.data;

      // Add to sidebar chats list if not already there
      setChats((prev) => {
        if (prev.some((c) => c._id === newOrExistingChat._id)) return prev;
        return [newOrExistingChat, ...prev];
      });

      const otherUser = newOrExistingChat.participants.find((u) => u._id !== currentUser.id && u._id !== currentUser._id);
      setSelectedUser({
        ...otherUser,
        chatId: newOrExistingChat._id,
        isGroupChat: false,
        fullChat: newOrExistingChat,
      });
      setViewingUserProfile(null);
    } catch (err) {
      console.error("Failed to start DM:", err);
    }
  };

  return (
    <div className="h-screen bg-app-chat flex overflow-hidden">
      {/* SIDEBAR */}
      <div
        className={`
          ${selectedUser ? "hidden md:flex" : "flex"}
          w-full
          md:w-[380px]
          border-r
          border-app-border
        `}
      >
        <Sidebar
          selectedUser={selectedUser}
          setSelectedUser={setSelectedUser}
          unreadCounts={unreadCounts}
          onlineUsers={onlineUsers}
          typingUsers={typingUsers}
          chats={chats}
          setChats={setChats}
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          archivedChats={archivedChats}
          setArchivedChats={setArchivedChats}
          lockedChats={lockedChats}
          setLockedChats={setLockedChats}
        />
      </div>

      {/* CHAT WINDOW */}
      <div
        className={`
          ${selectedUser ? "flex" : "hidden md:flex"}
          flex-1
        `}
      >
        {selectedUser?.isAiChat ? (
          <AiAssistantWindow
            conversation={selectedUser.conversation}
            onUpdateConversation={(updatedConv) => {
              setSelectedUser((prev) => ({
                ...prev,
                conversation: updatedConv,
              }));
              window.dispatchEvent(new CustomEvent("ai-conversations-updated"));
            }}
            onClearHistory={() => {
              setSelectedUser(null);
              window.dispatchEvent(new CustomEvent("ai-conversations-updated"));
            }}
          />
        ) : (
          <ChatWindow
            selectedUser={selectedUser}
            setSelectedUser={setSelectedUser}
            setUnreadCounts={setUnreadCounts}
            onlineUsers={onlineUsers}
            lastSeenUsers={lastSeenUsers}
            setChats={setChats}
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
          />
        )}
      </div>

      <UserProfileModal
        isOpen={!!viewingUserProfile}
        onClose={() => setViewingUserProfile(null)}
        user={viewingUserProfile}
        onlineUsers={onlineUsers}
        lastSeenUsers={lastSeenUsers}
        chats={chats}
        onStartDM={handleStartDM}
      />

      <CallOverlay />
    </div>
  );
}

export default ChatPage;
