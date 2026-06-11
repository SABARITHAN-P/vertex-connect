import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import api from "@services/api";
import logo from "@assets/vite.svg";
import MessageBubble from "@components/features/chat/MessageBubble";
import MessageInput from "@components/features/chat/MessageInput";
import PinnedMessagesBanner from "@components/features/chat/PinnedMessagesBanner";
import { useTheme } from "@context/ThemeContext";
import { playReceivedSound } from "@utils/soundHelper";
import GroupDetailsDrawer from "@components/features/group/GroupDetailsDrawer";
import MediaViewer from "@components/features/media/MediaViewer";
import { socket } from "@socket/socket";
import { Phone, Video, MoreVertical, Search, X, ChevronUp, ChevronDown, Lock, Ban, Users, User, Info, Trash2, BellOff, LogOut, FolderOpen, UserPlus } from "lucide-react";
import { formatLastSeen } from "@utils/dateFormatter";
import { useEscapeKey } from "@hooks/useEscapeKey";
import { useCall } from "@context/CallContext";
import toast from "react-hot-toast";

function ChatWindow({
  selectedUser,
  setSelectedUser,
  setUnreadCounts,
  onlineUsers,
  lastSeenUsers = {},
  setChats,
  currentUser,
  setCurrentUser,
}) {
  const { soundsEnabled, autoScroll, getWallpaperStyle } = useTheme();
  const { initiateCall } = useCall();
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({}); // { userId: username }
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState({});

  // Group UI helpers
  const [showDrawer, setShowDrawer] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [replyToMsg, setReplyToMsg] = useState(null);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [isMediaViewerOpen, setIsMediaViewerOpen] = useState(false);
  const [chatPermission, setChatPermission] = useState({ allowed: true });

  const fetchChatPermissions = async () => {
    if (!selectedUser?.chatId) return;
    try {
      const { data } = await api.get(`/chat/permissions/${selectedUser.chatId}`);
      setChatPermission(data);
    } catch (err) {
      console.error("Failed to fetch chat permissions:", err);
    }
  };

  // Search inside group
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);

  // Chat Options Menu States
  const [showMenu, setShowMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showMuteModal, setShowMuteModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [passcodePrompt, setPasscodePrompt] = useState(null); // null | { type: 'lock' | 'unlock' }
  const [passcodeValue, setPasscodeValue] = useState("");

  // Centralized ESC handling in ChatWindow: close search inside group/chat on ESC
  useEscapeKey(() => {
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
    setCurrentSearchIndex(-1);
  }, showSearch, 10);

  useEscapeKey(() => {
    setShowMenu(false);
  }, showMenu, 11);

  useEscapeKey(() => {
    setShowMuteModal(false);
  }, showMuteModal, 12);

  useEscapeKey(() => {
    setShowClearConfirm(false);
  }, showClearConfirm, 13);

  useEscapeKey(() => {
    setShowLeaveConfirm(false);
  }, showLeaveConfirm, 14);

  useEscapeKey(() => {
    setShowBlockConfirm(false);
  }, showBlockConfirm, 15);

  useEscapeKey(() => {
    setPasscodePrompt(null);
    setPasscodeValue("");
  }, passcodePrompt !== null, 16);

  const chatContainerRef = useRef(null);
  const messagesContentRef = useRef(null);
  const searchInputRef = useRef(null);
  const previousMessageCountRef = useRef(0);
  const shouldScrollInstant = useRef(true);
  const [isInitialScrollSyncing, setIsInitialScrollSyncing] = useState(true);
  const lastMessageIdRef = useRef(null);
  const userInfo = currentUser || JSON.parse(localStorage.getItem("userInfo")) || {};

  useEffect(() => {
    if (showSearch) {
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    }
  }, [showSearch]);

  const isOnline = onlineUsers?.some(id => id?.toString() === selectedUser?._id?.toString() || id?.toString() === selectedUser?.id?.toString());

  /* =========================
     SCROLL TO BOTTOM / TARGET
  ========================== */

  const jumpToMessage = (messageId) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("bg-brand/20");
      setTimeout(() => el.classList.remove("bg-brand/20"), 2000);
    }
  };

  /* =========================
     LOAD MESSAGES
  ========================== */
  const loadMessages = async (pageNum = 1, isOlder = false) => {
    try {
      const { data } = await api.get(
        `/message/${selectedUser.chatId}?page=${pageNum}&limit=20`,
      );
      setMessages((prev) => (isOlder ? [...data.messages, ...prev] : data.messages));
      setHasMore(data.hasMore);
      return data.messages;
    } catch (error) {
      console.log(error);
      return [];
    }
  };

  /* =========================
     INITIAL CHAT LOAD
  ========================== */
  useEffect(() => {
    if (!selectedUser?.chatId) return;

    let isMounted = true;
    setTimeout(() => {
      if (isMounted) setShowDrawer(false);
    }, 0);
    shouldScrollInstant.current = true;
    setIsInitialScrollSyncing(true);
    lastMessageIdRef.current = null;

    const initializeChat = async () => {
      setUnreadCounts((prev) => ({
        ...prev,
        [selectedUser.chatId]: 0,
      }));

      try {
        setInitialLoading(true);
        setMessages([]);
        setPage(1);
        setHasMore(true);
        setTypingUsers({});

        // Pinned messages loading for DMs and groups
        setPinnedMessages(selectedUser.fullChat?.pinnedMessages || []);

        socket.emit("joinChat", selectedUser.chatId);
        if (selectedUser.isGroupChat) {
          socket.emit("group:join", selectedUser.chatId);
        }

        await loadMessages(1);
        await fetchChatPermissions();
        await api.patch(`/message/read/${selectedUser.chatId}`);
      } catch (error) {
        console.log(error);
      } finally {
        if (isMounted) {
          setInitialLoading(false);
        }
      }
    };

    initializeChat();

    socket.on("follow:update", fetchChatPermissions);
    socket.on("block:update", fetchChatPermissions);
    socket.on("privacy:updated", fetchChatPermissions);

    return () => {
      isMounted = false;
      socket.off("follow:update", fetchChatPermissions);
      socket.off("block:update", fetchChatPermissions);
      socket.off("privacy:updated", fetchChatPermissions);
      socket.emit("leaveChat", selectedUser.chatId);
      if (selectedUser.isGroupChat) {
        socket.emit("group:leave", selectedUser.chatId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser?.chatId]);

  /* =========================
     LOAD OLDER MESSAGES
  ========================== */
  const loadOlderMessages = async () => {
    if (!hasMore || loadingOlder) return;
    try {
      setLoadingOlder(true);
      const container = chatContainerRef.current;
      if (!container) return;

      const previousHeight = container.scrollHeight;
      const nextPage = page + 1;
      await loadMessages(nextPage, true);
      setPage(nextPage);

      requestAnimationFrame(() => {
        const newHeight = container.scrollHeight;
        container.scrollTop = newHeight - previousHeight;
      });
    } catch (error) {
      console.log(error);
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleScroll = () => {
    const container = chatContainerRef.current;
    if (!container) return;
    if (container.scrollTop <= 50 && hasMore && !loadingOlder) {
      container.scrollTop = 60;
      loadOlderMessages();
    }
  };

  /* =========================
     AUTO SCROLL ON NEW MESSAGES & INITIAL SYNC
     ========================== */
  useLayoutEffect(() => {
    const container = chatContainerRef.current;
    if (!container || initialLoading || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    if (isInitialScrollSyncing) {
      // Synchronously snap to the bottom of the container
      container.scrollTop = container.scrollHeight;
      lastMessageIdRef.current = lastMessage._id;
      
      // Release paint lock on next microtask
      queueMicrotask(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
        setIsInitialScrollSyncing(false);
      });
      return;
    }

    // New Message scroll logic (only if a new message was actually appended)
    if (lastMessage._id !== lastMessageIdRef.current) {
      const oldLastId = lastMessageIdRef.current;
      lastMessageIdRef.current = lastMessage._id;

      // Ensure it is an addition at the bottom (new message index greater, not pagination prepend)
      const currentCount = messages.length;
      const previousCount = previousMessageCountRef.current;
      
      if (currentCount > previousCount && oldLastId !== null) {
        const isOwn = lastMessage?.sender?._id === userInfo?.id || 
                      lastMessage?.sender === userInfo?.id || 
                      lastMessage?.sender?._id === userInfo?._id || 
                      lastMessage?.sender === userInfo?._id;
        
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 350;

        if (isOwn || (autoScroll && isNearBottom)) {
          container.scrollTop = container.scrollHeight;
        }
      }
    }
    previousMessageCountRef.current = messages.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, initialLoading, selectedUser?.chatId, isInitialScrollSyncing]);

  // Capture-phase Image Loading Observer for Async Layout Shifts
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleImageLoad = () => {
      if (isInitialScrollSyncing) {
        container.scrollTop = container.scrollHeight;
        return;
      }
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 350;
      if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    };

    container.addEventListener("load", handleImageLoad, true); // Capture phase hooks <img> load events inside MessageBubbles
    return () => container.removeEventListener("load", handleImageLoad, true);
  }, [selectedUser?.chatId, isInitialScrollSyncing]);

  // Robust ResizeObserver for Instant Paint-Cycle Scroll Anchoring
  useEffect(() => {
    const container = chatContainerRef.current;
    const content = messagesContentRef.current;
    if (!container || !content) return;

    const observer = new ResizeObserver(() => {
      if (isInitialScrollSyncing) {
        container.scrollTop = container.scrollHeight;
      }
    });

    observer.observe(content);
    return () => observer.disconnect();
  }, [selectedUser?.chatId, isInitialScrollSyncing]);

  /* =========================
     SEARCH ROUTINE
  ========================== */
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const { data } = await api.get(`/message/search/${selectedUser.chatId}?query=${searchQuery}`);
      setSearchResults(data);
      if (data.length > 0) {
        setCurrentSearchIndex(0);
        jumpToMessage(data[0]._id);
      } else {
        setCurrentSearchIndex(-1);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearchUp = () => {
    if (searchResults.length === 0) return;
    const nextIdx = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIdx);
    jumpToMessage(searchResults[nextIdx]._id);
  };

  const handleSearchDown = () => {
    if (searchResults.length === 0) return;
    const prevIdx = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentSearchIndex(prevIdx);
    jumpToMessage(searchResults[prevIdx]._id);
  };

  /* =========================
     SOCKET ACTIONS AND ROUTINGS
  ========================== */
  useEffect(() => {
    const handleNewMessage = async (newMessage) => {
      try {
        const senderId = newMessage.sender?._id || newMessage.sender;
        const isOwn = senderId === userInfo?.id || senderId === userInfo?._id;

        if (!isOwn && soundsEnabled) {
          playReceivedSound();
        }

        if (!isOwn) {
          await api.patch(`/message/delivered/${newMessage._id}`);
        }

        const incomingChatId = typeof newMessage.chat === "object" ? newMessage.chat._id : newMessage.chat;

        setChats((prev) => {
          const updatedChats = prev.map((chat) => {
            if (chat._id === incomingChatId.toString()) {
              return { ...chat, lastMessage: newMessage };
            }
            return chat;
          });
          updatedChats.sort((a, b) => {
            if (a._id === incomingChatId.toString()) return -1;
            if (b._id === incomingChatId.toString()) return 1;
            return 0;
          });
          return updatedChats;
        });

        if (incomingChatId === selectedUser?.chatId) {
          setMessages((prev) => {
            if (prev.some((msg) => msg._id === newMessage._id)) return prev;
            return [...prev, newMessage];
          });
          await api.patch(`/message/read/${selectedUser.chatId}`);
          setUnreadCounts((prev) => ({ ...prev, [incomingChatId]: 0 }));
        } else {
          setUnreadCounts((prev) => ({ ...prev, [incomingChatId]: (prev[incomingChatId] || 0) + 1 }));
        }
      } catch (error) {
        console.log(error);
      }
    };

    const handleStatusUpdate = (updatedMessage) => {
      setMessages((prev) => prev.map((msg) => (msg._id === updatedMessage._id ? { ...msg, messageStatus: updatedMessage.messageStatus } : msg)));
    };

    const handleReactionUpdate = (data) => {
      setMessages((prev) => prev.map((msg) => (msg._id === data.messageId ? { ...msg, reactions: data.reactions } : msg)));
    };

    // Group Socket Indicators
    const handleGroupTypingStart = (data) => {
      if (data.chatId === selectedUser?.chatId) {
        setTypingUsers((prev) => ({
          ...prev,
          [data.senderId]: {
            username: data.senderName,
            avatar: data.senderAvatar
          }
        }));
      }
    };

    const handleGroupTypingStop = (data) => {
      if (data.chatId === selectedUser?.chatId) {
        setTypingUsers((prev) => {
          const next = { ...prev };
          delete next[data.senderId];
          return next;
        });
      }
    };

    const handlePollVoted = (data) => {
      setMessages((prev) => prev.map((msg) => (msg._id === data.messageId ? { ...msg, poll: data.poll } : msg)));
    };

    const handlePinnedUpdated = (data) => {
      if (data.chatId === selectedUser?.chatId) {
        setPinnedMessages(data.pinnedMessages);
        setSelectedUser((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            fullChat: {
              ...prev.fullChat,
              pinnedMessages: data.pinnedMessages,
            },
          };
        });
      }
      setChats((prev) =>
        prev.map((chat) => {
          if (chat._id === data.chatId) {
            return {
              ...chat,
              pinnedMessages: data.pinnedMessages,
            };
          }
          return chat;
        })
      );
    };

    const handleMessageEdited = (data) => {
      setMessages((prev) => prev.map((msg) => (msg._id === data._id ? data : msg)));
    };

    const handleMessageDeletedForEveryone = (data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId
            ? { ...msg, isDeleted: true, content: "This message was deleted", media: [], caption: "", poll: undefined }
            : msg
        )
      );
    };

    const handleMessageDeletedForMe = (data) => {
      setMessages((prev) => prev.filter((msg) => msg._id !== data.messageId));
    };

    // Realtime Background Upload Sockets
    const handleRemoteUploadStarted = (data) => {
      if (data.chatId === selectedUser?.chatId && data.senderId !== userInfo.id) {
        setMessages((prev) => {
          if (prev.some((msg) => msg._id === data.tempId)) return prev;
          return [
            ...prev,
            {
              _id: data.tempId,
              optimistic: true,
              sender: { _id: data.senderId },
              createdAt: new Date(),
              content: "Uploading attachment...",
              messageType: "media",
              media: [{ type: "image", url: "", isRemoteUploading: true }],
              reactions: [],
              messageStatus: [],
            }
          ];
        });
      }
    };

    const handleRemoteUploadProgress = (data) => {
      if (data.chatId === selectedUser?.chatId) {
        setUploadQueue((prev) => ({
          ...prev,
          [data.tempId]: {
            ...prev[data.tempId],
            progress: data.progress,
            status: "uploading"
          }
        }));
      }
    };

    const handleRemoteUploadComplete = (data) => {
      if (data.chatId === selectedUser?.chatId) {
        setMessages((prev) => prev.map((msg) => (msg._id === data.tempId ? data.message : msg)));
        setUploadQueue((prev) => {
          const next = { ...prev };
          delete next[data.tempId];
          return next;
        });
      }
    };

    const handleRemoteUploadFailed = (data) => {
      if (data.chatId === selectedUser?.chatId) {
        setUploadQueue((prev) => ({
          ...prev,
          [data.tempId]: {
            ...prev[data.tempId],
            status: "failed",
            error: data.error
          }
        }));
      }
    };

    // Live Profile Updates Sockets
    const handleUserProfileUpdated = (data) => {
      // 1. Update Selected User (either Direct Chat or Group Chat participant list)
      if (selectedUser) {
        if (!selectedUser.isGroupChat && selectedUser._id === data.userId) {
          setSelectedUser((prev) => ({
            ...prev,
            username: data.username || prev.username,
            avatar: data.avatar || prev.avatar,
          }));
        } else if (selectedUser.isGroupChat) {
          setSelectedUser((prev) => {
            const updatedParticipants = prev.participants?.map((p) =>
              p._id === data.userId ? { ...p, username: data.username || p.username, avatar: data.avatar || p.avatar } : p
            );
            const updatedFullChatParticipants = prev.fullChat?.participants?.map((p) =>
              p._id === data.userId ? { ...p, username: data.username || p.username, avatar: data.avatar || p.avatar } : p
            );
            return {
              ...prev,
              participants: updatedParticipants,
              fullChat: prev.fullChat ? { ...prev.fullChat, participants: updatedFullChatParticipants } : prev.fullChat,
            };
          });
        }
      }

      // 2. Update all visible messages in current chat window
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.sender && (msg.sender._id === data.userId || msg.sender === data.userId)) {
            const updatedSender = typeof msg.sender === "object"
              ? { ...msg.sender, username: data.username || msg.sender.username, avatar: data.avatar || msg.sender.avatar }
              : msg.sender;
            return {
              ...msg,
              sender: updatedSender,
            };
          }
          return msg;
        })
      );

      // 3. Update the sidebar chats state (participants list & latestMessage sender)
      setChats((prev) =>
        prev.map((chat) => {
          let hasUpdated = false;
          const updatedParticipants = chat.participants?.map((p) => {
            if (p._id === data.userId) {
              hasUpdated = true;
              return { ...p, username: data.username || p.username, avatar: data.avatar || p.avatar };
            }
            return p;
          });

          let updatedLastMessage = chat.lastMessage;
          if (chat.lastMessage && chat.lastMessage.sender && (chat.lastMessage.sender._id === data.userId || chat.lastMessage.sender === data.userId)) {
            hasUpdated = true;
            updatedLastMessage = {
              ...chat.lastMessage,
              sender: typeof chat.lastMessage.sender === "object"
                ? { ...chat.lastMessage.sender, username: data.username || chat.lastMessage.sender.username, avatar: data.avatar || chat.lastMessage.sender.avatar }
                : chat.lastMessage.sender,
            };
          }

          if (hasUpdated) {
            return {
              ...chat,
              participants: updatedParticipants,
              lastMessage: updatedLastMessage,
            };
          }
          return chat;
        })
      );
    };

    const handleGroupProfileUpdated = (data) => {
      if (selectedUser?.chatId === data.chatId) {
        setSelectedUser((prev) => ({
          ...prev,
          username: data.chatName || prev.username,
          avatar: data.groupAvatar || prev.avatar,
          fullChat: {
            ...prev.fullChat,
            chatName: data.chatName || prev.fullChat?.chatName,
            groupAvatar: data.groupAvatar || prev.fullChat?.groupAvatar,
            groupDescription: data.groupDescription || prev.fullChat?.groupDescription,
          }
        }));
      }
      setChats((prev) =>
        prev.map((chat) => {
          if (chat._id === data.chatId) {
            return {
              ...chat,
              chatName: data.chatName || chat.chatName,
              groupAvatar: data.groupAvatar || chat.groupAvatar,
              groupDescription: data.groupDescription || chat.groupDescription,
            };
          }
          return chat;
        })
      );
    };

    socket.on("newMessage", handleNewMessage);
    socket.on("messageStatusUpdated", handleStatusUpdate);
    socket.on("messageReactionUpdated", handleReactionUpdate);
    socket.on("typing", handleGroupTypingStart);
    socket.on("stopTyping", handleGroupTypingStop);
    socket.on("group:typing-start", handleGroupTypingStart);
    socket.on("group:typing-stop", handleGroupTypingStop);
    socket.on("group:poll-voted", handlePollVoted);
    socket.on("group:pinned-updated", handlePinnedUpdated);
    socket.on("group:message-edited", handleMessageEdited);
    socket.on("message:deleted-for-everyone", handleMessageDeletedForEveryone);
    socket.on("message:deleted-for-me", handleMessageDeletedForMe);
    socket.on("group:message-deleted", handleMessageDeletedForEveryone);

    socket.on("message:upload-started", handleRemoteUploadStarted);
    socket.on("message:upload-progress", handleRemoteUploadProgress);
    socket.on("message:upload-complete", handleRemoteUploadComplete);
    socket.on("message:upload-failed", handleRemoteUploadFailed);
    socket.on("user:profile-updated", handleUserProfileUpdated);
    socket.on("group:profile-updated", handleGroupProfileUpdated);

    const handleLocalChatCleared = (e) => {
      const { chatId } = e.detail;
      if (chatId === selectedUser?.chatId) {
        setMessages([]);
      }
    };
    window.addEventListener("chat-cleared", handleLocalChatCleared);

    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("messageStatusUpdated", handleStatusUpdate);
      socket.off("messageReactionUpdated", handleReactionUpdate);
      socket.off("typing", handleGroupTypingStart);
      socket.off("stopTyping", handleGroupTypingStop);
      socket.off("group:typing-start", handleGroupTypingStart);
      socket.off("group:typing-stop", handleGroupTypingStop);
      socket.off("group:poll-voted", handlePollVoted);
      socket.off("group:pinned-updated", handlePinnedUpdated);
      socket.off("group:message-edited", handleMessageEdited);
      socket.off("message:deleted-for-everyone", handleMessageDeletedForEveryone);
      socket.off("message:deleted-for-me", handleMessageDeletedForMe);
      socket.off("group:message-deleted", handleMessageDeletedForEveryone);

      socket.off("message:upload-started", handleRemoteUploadStarted);
      socket.off("message:upload-progress", handleRemoteUploadProgress);
      socket.off("message:upload-complete", handleRemoteUploadComplete);
      socket.off("message:upload-failed", handleRemoteUploadFailed);
      socket.off("user:profile-updated", handleUserProfileUpdated);
      socket.off("group:profile-updated", handleGroupProfileUpdated);

      window.removeEventListener("chat-cleared", handleLocalChatCleared);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser?.chatId, setChats, setUnreadCounts]);

  const handleGroupUpdated = (updatedChat) => {
    setSelectedUser((prev) => ({
      ...prev,
      username: updatedChat.chatName,
      avatar: updatedChat.groupAvatar,
      fullChat: updatedChat,
    }));
    setChats((prev) => prev.map((chat) => (chat._id === updatedChat._id ? updatedChat : chat)));
  };

  const handleUnpinMessage = async (messageId) => {
    try {
      const { data } = await api.put(`/message/pin/${messageId}`);
      setPinnedMessages(data);
      setSelectedUser((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          fullChat: {
            ...prev.fullChat,
            pinnedMessages: data,
          },
        };
      });
      setChats((prev) =>
        prev.map((chat) => {
          if (chat._id === selectedUser.chatId) {
            return {
              ...chat,
              pinnedMessages: data,
            };
          }
          return chat;
        })
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleLeaveGroupAction = (chatId) => {
    setChats((prev) => prev.filter((chat) => chat._id !== chatId));
    setSelectedUser(null);
  };





  const allMediaItems = messages
    .flatMap((msg) => {
      const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const senderName = msg.sender?.username || "User";
      
      if (msg.media && msg.media.length > 0) {
        return msg.media.map((item) => ({
          url: item.url,
          type: item.type,
          senderName,
          time,
          caption: msg.caption,
          _id: msg._id,
        }));
      } else if (msg.mediaUrl) {
        return [{
          url: msg.mediaUrl,
          type: msg.messageType,
          senderName,
          time,
          caption: msg.caption,
          _id: msg._id,
        }];
      }
      return [];
    })
    .filter((item) => item.type === "image" || item.type === "video");

  const handleViewMedia = (mediaItem) => {
    setSelectedMedia(mediaItem);
    setIsMediaViewerOpen(true);
  };

  const menuRef = useRef(null);

  // Mute notifications check on mount / change
  useEffect(() => {
    if (!selectedUser?.chatId) return;
    const mutedData = JSON.parse(localStorage.getItem("muted_chats") || "{}");
    const until = mutedData[selectedUser.chatId];
    const shouldBeMuted = !!(until && until > Date.now());
    const timer = setTimeout(() => {
      setIsMuted(shouldBeMuted);
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedUser?.chatId]);

  // Click outside menu listener
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  const handleMute = useCallback((durationHours) => {
    const mutedData = JSON.parse(localStorage.getItem("muted_chats") || "{}");
    const now = Date.now();
    let until;
    if (durationHours === "always") {
      until = now + 100 * 365 * 24 * 60 * 60 * 1000; // 100 years
    } else {
      until = now + durationHours * 60 * 60 * 1000;
    }
    mutedData[selectedUser.chatId] = until;
    localStorage.setItem("muted_chats", JSON.stringify(mutedData));
    setIsMuted(true);
    setShowMuteModal(false);
    setShowMenu(false);
    toast.success("Notifications muted");
  }, [selectedUser?.chatId]);

  const handleUnmute = useCallback(() => {
    const mutedData = JSON.parse(localStorage.getItem("muted_chats") || "{}");
    delete mutedData[selectedUser.chatId];
    localStorage.setItem("muted_chats", JSON.stringify(mutedData));
    setIsMuted(false);
    setShowMenu(false);
    toast.success("Notifications unmuted");
  }, [selectedUser?.chatId]);

  const handleClearChatSubmit = async () => {
    try {
      await api.post(`/chat/clear/${selectedUser.chatId}`);
      setMessages([]);
      setShowClearConfirm(false);
      setShowMenu(false);

      // Clear the lastMessage preview locally
      setChats((prev) =>
        prev.map((c) =>
          c._id === selectedUser.chatId ? { ...c, lastMessage: null } : c
        )
      );

      // Dispatch event to sync with other windows
      window.dispatchEvent(new CustomEvent("chat-cleared", { detail: { chatId: selectedUser.chatId } }));
      toast.success("Chat cleared");
    } catch (err) {
      console.error(err);
      toast.error("Failed to clear chat");
    }
  };

  const handleLockUnlockClick = (actionType) => {
    setShowMenu(false);
    setPasscodeValue("");
    setPasscodePrompt({ type: actionType });
  };

  const handleVerifyPasscode = async () => {
    if (!passcodePrompt || passcodeValue.length < 4) {
      toast.error("Please enter a 4-digit passcode");
      return;
    }

    const { type } = passcodePrompt;
    const currentUserIdStr = currentUser?._id?.toString() || currentUser?.id?.toString();
    try {
      if (type === "lock") {
        await api.post(`/chat/lock/${selectedUser.chatId}`, { passcode: passcodeValue });
        sessionStorage.setItem(`lock_passcode_${selectedUser.chatId}`, passcodeValue);

        setChats((prev) =>
          prev.map((c) =>
            c._id === selectedUser.chatId
              ? { ...c, lockedBy: [{ user: currentUserIdStr, passcodeHash: "hidden" }] }
              : c
          )
        );

        setSelectedUser((prev) => ({
          ...prev,
          lockedBy: [{ user: currentUserIdStr, passcodeHash: "hidden" }]
        }));

        toast.success("🔒 Chat locked successfully");
      } else if (type === "unlock") {
        await api.post(`/chat/unlock/${selectedUser.chatId}`, { passcode: passcodeValue });
        sessionStorage.removeItem(`lock_passcode_${selectedUser.chatId}`);

        setChats((prev) =>
          prev.map((c) =>
            c._id === selectedUser.chatId
              ? { ...c, lockedBy: [] }
              : c
          )
        );

        setSelectedUser((prev) => ({
          ...prev,
          lockedBy: []
        }));

        toast.success("🔓 Chat unlocked successfully");
      }
      setPasscodePrompt(null);
      setPasscodeValue("");
    } catch (err) {
      console.error("Failed to verify passcode:", err);
      toast.error(err.response?.data?.message || "Failed to update lock state");
    }
  };

  const handleArchiveChat = async () => {
    const currentUserIdStr = currentUser?._id?.toString() || currentUser?.id?.toString();
    try {
      const res = await api.post(`/chat/archive/${selectedUser.chatId}`);
      const isArchived = res.data.isArchived;

      setChats((prev) =>
        prev.map((c) =>
          c._id === selectedUser.chatId
            ? { ...c, archivedBy: isArchived ? [{ user: currentUserIdStr, archivedAt: new Date() }] : [] }
            : c
        )
      );

      setSelectedUser(null);
      toast.success(isArchived ? "📁 Chat archived successfully" : "📁 Chat unarchived successfully");
    } catch (err) {
      console.error("Failed to archive chat:", err);
      toast.error("Failed to toggle archive state");
    }
  };

  const handleLeaveGroupSubmit = async () => {
    try {
      await api.post("/chat/group/leave", { chatId: selectedUser.chatId });
      handleLeaveGroupAction(selectedUser.chatId);
      setShowLeaveConfirm(false);
      setShowMenu(false);
      toast.success("Left group successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to leave group");
    }
  };

  const handleBlockContactSubmit = async () => {
    if (!selectedUser) return;
    const targetId = selectedUser._id || selectedUser.id;
    try {
      await api.post(`/user/block/${targetId}`);
      toast.success("Contact blocked");
      setShowBlockConfirm(false);
      fetchChatPermissions();
    } catch (err) {
      console.error(err);
      toast.error("Failed to block contact");
    }
  };

  const handleUnblockContact = async () => {
    if (!selectedUser) return;
    const targetId = selectedUser._id || selectedUser.id;
    try {
      await api.post(`/user/unblock/${targetId}`);
      toast.success("Contact unblocked");
      fetchChatPermissions();
    } catch (err) {
      console.error(err);
      toast.error("Failed to unblock contact");
    }
  };

  if (!selectedUser) {
    return (
      <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-app-chat border-l border-app-border text-app-text-primary relative select-none p-6">
        <div className="max-w-md text-center flex flex-col items-center gap-5 animate-fade-in">
          {/* Brand Logo Icon */}
          <div className="w-20 h-20 rounded-2xl bg-app-header/40 flex items-center justify-center border border-app-border/40 p-4 select-none">
            <img src={logo} alt="Vertex Connect Logo" className="w-12 h-12" />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-light tracking-wide text-app-text-primary">
              Vertex Connect
            </h1>
            <p className="text-sm text-app-text-secondary leading-relaxed max-w-sm mx-auto">
              Send and receive messages instantly. Select a conversation to start chatting.
            </p>
          </div>
        </div>

        {/* Minimal Footer */}
        <div className="absolute bottom-8 flex items-center gap-1.5 text-xs text-app-text-secondary/60">
          <svg 
            className="w-3.5 h-3.5"
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <span>Secure Connection</span>
        </div>
      </div>
    );
  }

  const currentUserRoleObj = selectedUser.fullChat?.roles?.find((r) => {
    const rUserId = typeof r.user === "object" && r.user !== null ? r.user._id : r.user;
    const currentId = userInfo?.id || userInfo?._id;
    return rUserId?.toString() === currentId?.toString();
  });
  const currentUserRole = currentUserRoleObj ? currentUserRoleObj.role : "member";
  const isUserAdminOrOwner = ["owner", "admin"].includes(currentUserRole);

  const currentUserIdStr = currentUser?._id?.toString() || currentUser?.id?.toString();
  const isChatLocked = selectedUser?.lockedBy?.some(l => l.user?.toString() === currentUserIdStr);
  const isChatArchived = selectedUser?.archivedBy?.some(a => a.user?.toString() === currentUserIdStr);

  const wallpaperStyle = getWallpaperStyle();

  return (
    <div className="flex flex-1 bg-app-chat h-full relative overflow-hidden">
      <div className="flex-1 flex flex-col h-full min-w-0 relative">
        
        {/* PERSONAL WALLPAPER LAYERS */}
        <div style={wallpaperStyle.backgroundStyle} className={wallpaperStyle.className}></div>
        <div style={wallpaperStyle.overlayStyle}></div>

        {/* CHAT HEADER */}
        <div className="relative z-50 h-[60px] bg-app-header flex items-center justify-between px-4 border-l border-app-border shadow-md shrink-0">
          <div 
            className="flex items-center cursor-pointer min-w-0 flex-1" 
            onClick={() => {
              if (selectedUser.isGroupChat) {
                setShowDrawer(true);
              } else {
                window.dispatchEvent(new CustomEvent("view-user-profile", { detail: selectedUser }));
              }
            }}
          >
            <button className="md:hidden text-app-text-primary mr-4 text-xl" onClick={(e) => { e.stopPropagation(); setSelectedUser(null); }}>
              ←
            </button>

            {selectedUser.avatar ? (
              <img src={selectedUser.avatar} alt="Avatar" className="w-10 h-10 rounded-full object-cover shrink-0 border border-app-border/50" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-brand/10 dark:bg-brand/25 flex items-center justify-center text-brand dark:text-white font-semibold text-base shrink-0 border border-app-border/40">
                {selectedUser.isGroupChat ? "👥" : selectedUser.username[0].toUpperCase()}
              </div>
            )}

            <div className="ml-3 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 className="text-app-text-primary font-medium truncate text-sm">{selectedUser.username}</h2>
                {isMuted && <BellOff size={14} className="text-app-text-secondary shrink-0" />}
              </div>
              {selectedUser.isGroupChat ? (
                <p className="text-xs text-app-text-secondary truncate">
                  {selectedUser.fullChat?.participants?.length} members
                </p>
              ) : (
                <p className={`text-xs ${isOnline ? "text-brand font-medium animate-pulse" : "text-app-text-secondary"}`}>
                  {isOnline ? "online" : formatLastSeen(lastSeenUsers[selectedUser._id] || selectedUser.lastSeen)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-5 text-app-text-secondary shrink-0">
            <button onClick={() => setShowSearch(!showSearch)} className="hover:text-app-text-primary transition font-semibold" title="Search Messages">
              <Search size={20} />
            </button>
            {!selectedUser.isGroupChat && (
              <>
                <button
                  onClick={() => initiateCall(selectedUser, "video")}
                  className="hover:text-app-text-primary transition cursor-pointer"
                  title="Video Call"
                >
                  <Video size={22} />
                </button>
                <button
                  onClick={() => initiateCall(selectedUser, "voice")}
                  className="hover:text-app-text-primary transition cursor-pointer"
                  title="Voice Call"
                >
                  <Phone size={20} />
                </button>
              </>
            )}
            
            {/* Dynamic Options Menu Dropdown */}
            <div className="relative flex items-center" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className={`p-2 hover:bg-app-hover rounded-full transition cursor-pointer flex items-center justify-center ${showMenu ? "text-app-text-primary bg-app-hover" : "text-app-text-secondary hover:text-app-text-primary"}`}
                title="Chat Options"
              >
                <MoreVertical size={20} />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-11 w-56 bg-app-modal border border-app-border rounded-xl shadow-xl z-30 py-1.5 animate-scale-in text-left">
                  
                  {/* Common Options */}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      if (selectedUser.isGroupChat) {
                        setShowDrawer(true);
                      } else {
                        window.dispatchEvent(new CustomEvent("view-user-profile", { detail: selectedUser }));
                      }
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-app-hover text-sm font-medium text-app-text-primary transition flex items-center gap-3"
                  >
                    {selectedUser.isGroupChat ? <Info size={16} className="text-app-text-secondary" /> : <User size={16} className="text-app-text-secondary" />}
                    <span>{selectedUser.isGroupChat ? "Group Info" : "View Contact"}</span>
                  </button>

                  {selectedUser.isGroupChat && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowDrawer(true);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-app-hover text-sm font-medium text-app-text-primary transition flex items-center gap-3"
                    >
                      <Users size={16} className="text-app-text-secondary" />
                      <span>Members List</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowSearch(true);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-app-hover text-sm font-medium text-app-text-primary transition flex items-center gap-3"
                  >
                    <Search size={16} className="text-app-text-secondary" />
                    <span>Search Messages</span>
                  </button>



                  <button
                    onClick={() => {
                      if (isChatLocked) {
                        handleLockUnlockClick("unlock");
                      } else {
                        handleLockUnlockClick("lock");
                      }
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-app-hover text-sm font-medium text-app-text-primary transition flex items-center gap-3"
                  >
                    <Lock size={16} className="text-app-text-secondary" />
                    <span>{isChatLocked ? "Unlock Chat" : "Lock Chat"}</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      if (isMuted) {
                        handleUnmute();
                      } else {
                        setShowMuteModal(true);
                      }
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-app-hover text-sm font-medium text-app-text-primary transition flex items-center gap-3"
                  >
                    <BellOff size={16} className="text-app-text-secondary" />
                    <span>{isMuted ? "Unmute Notifications" : "Mute Notifications"}</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      handleArchiveChat();
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-app-hover text-sm font-medium text-app-text-primary transition flex items-center gap-3"
                  >
                    <FolderOpen size={16} className="text-app-text-secondary" />
                    <span>{isChatArchived ? "Unarchive Chat" : "Archive Chat"}</span>
                  </button>

                  {!selectedUser.isGroupChat && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        if (chatPermission?.reason === "blocked" && chatPermission?.isBlockedByMe) {
                          handleUnblockContact();
                        } else {
                          setShowBlockConfirm(true);
                        }
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-app-hover text-sm font-medium text-red-500 transition flex items-center gap-3 border-t border-app-border/40"
                    >
                      <Ban size={16} className="text-red-500/80" />
                      <span>{chatPermission?.reason === "blocked" && chatPermission?.isBlockedByMe ? "Unblock Contact" : "Block Contact"}</span>
                    </button>
                  )}

                  {/* Group Admin/Owner Options */}
                  {selectedUser.isGroupChat && isUserAdminOrOwner && (
                    <>
                      <div className="h-[1px] bg-app-border my-1" />
                      <div className="px-4 py-1 text-[9px] font-bold text-app-text-secondary uppercase tracking-wider select-none">
                        Admin Options
                      </div>
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setShowDrawer(true);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-app-hover text-sm font-medium text-app-text-primary transition flex items-center gap-3"
                      >
                        <UserPlus size={16} className="text-emerald-500" />
                        <span>Invite Members</span>
                      </button>
                    </>
                  )}

                  <div className="h-[1px] bg-app-border my-1" />

                  {/* Clear Chat */}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowClearConfirm(true);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-app-hover text-sm font-medium text-red-500 transition flex items-center gap-3"
                  >
                    <Trash2 size={16} className="text-red-500/80" />
                    <span>Clear Chat</span>
                  </button>

                  {/* Group Specific Actions */}
                  {selectedUser.isGroupChat && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowLeaveConfirm(true);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-app-hover text-sm font-medium text-red-500 border-t border-app-border transition flex items-center gap-3"
                    >
                      <LogOut size={16} className="text-red-500/80" />
                      <span>Leave Group</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PINNED MESSAGES BANNER */}
        {pinnedMessages.length > 0 && (
          <PinnedMessagesBanner
            pinnedMessages={pinnedMessages}
            onJumpToMessage={jumpToMessage}
            onUnpinMessage={handleUnpinMessage}
            isAdmin={selectedUser.isGroupChat ? isUserAdminOrOwner : true}
          />
        )}


        {/* SEARCH DRAWER / TOP PANEL */}
        {showSearch && (
          <div className="bg-app-header border-b border-app-border p-3 flex flex-col gap-2 animate-fade-in relative z-30 shadow-inner text-app-text-primary">
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative flex-1 flex items-center">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-app-drawer rounded-lg pl-3 pr-24 py-2 text-xs text-app-text-primary border border-app-border focus:border-brand outline-none transition placeholder-app-text-secondary"
                />
                
                {searchResults.length > 0 && (
                  <div className="absolute right-2 flex items-center gap-1.5 bg-app-hover px-2 py-0.5 rounded border border-app-border text-app-text-secondary select-none">
                    <span className="text-[10px] font-bold text-app-text-primary">
                      {currentSearchIndex + 1} of {searchResults.length}
                    </span>
                    <div className="w-[1px] h-3 bg-app-border mx-0.5" />
                    <button
                      type="button"
                      onClick={handleSearchUp}
                      className="hover:text-app-text-primary transition p-0.5"
                      title="Previous match (Up)"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={handleSearchDown}
                      className="hover:text-app-text-primary transition p-0.5"
                      title="Next match (Down)"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                )}
              </div>

              <button type="submit" className="bg-brand text-white px-4.5 py-2 rounded-lg text-xs font-semibold hover:opacity-90 transition shrink-0 shadow-md">
                Search
              </button>
              <button 
                type="button"
                onClick={() => { setShowSearch(false); setSearchResults([]); setCurrentSearchIndex(-1); setSearchQuery(""); }} 
                className="text-app-text-secondary hover:text-app-text-primary p-2 hover:bg-app-hover rounded-lg transition shrink-0"
              >
                <X size={18} />
              </button>
            </form>
          </div>
        )}

        {/* MESSAGES SCROLL AREA */}
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          style={{
            overflowAnchor: "auto",
            visibility: isInitialScrollSyncing ? "hidden" : "visible",
            zIndex: 10,
            backgroundColor: "transparent"
          }}
          className="flex-1 overflow-y-auto px-4 py-6 bg-transparent"
        >
          <div ref={messagesContentRef} className="min-h-full flex flex-col justify-end">
            {loadingOlder && <div className="text-center text-app-text-secondary text-xs mb-4">Loading older messages...</div>}

            {messages.length === 0 ? (
              <div className="h-full flex flex-1 items-center justify-center text-app-text-secondary text-sm">No messages yet</div>
            ) : (
              messages.map((msg) => (
                <div key={msg._id} id={`msg-${msg._id}`} className="transition-all duration-500 rounded-lg">
                  <MessageBubble
                    own={msg.sender?._id === userInfo.id || msg.sender === userInfo.id}
                    message={msg}
                    isGroup={selectedUser.isGroupChat}
                    onReply={(m) => setReplyToMsg(m)}
                    onViewMedia={handleViewMedia}
                    onJumpToMessage={jumpToMessage}
                    chatRoles={selectedUser.fullChat?.roles || []}
                    onPin={handleUnpinMessage}
                    isPinned={pinnedMessages.some((m) => (m._id || m) === msg._id)}
                    uploadQueue={uploadQueue}
                    setUploadQueue={setUploadQueue}
                    onEdit={(messageId, newContent) => {
                      setMessages((prev) =>
                        prev.map((msg) =>
                          msg._id === messageId
                            ? { ...msg, content: newContent, edited: true }
                            : msg
                        )
                      );
                    }}
                    onDelete={(messageId, deleteType) => {
                      if (deleteType === "forMe") {
                        setMessages((prev) => prev.filter((m) => m._id !== messageId));
                      } else {
                        setMessages((prev) =>
                          prev.map((m) =>
                            m._id === messageId
                              ? { ...m, isDeleted: true, content: "This message was deleted", media: [], caption: "", poll: undefined }
                              : m
                          )
                        );
                      }
                    }}
                  />
                </div>
              ))
            )}

            {/* MULTI TYPING STATE */}
            {Object.keys(typingUsers).length > 0 && (() => {
              const typingList = Object.entries(typingUsers);
              if (typingList.length === 0) return null;

              return (
                <div className="flex items-center gap-2 mb-2 animate-fade-in pl-1">
                  {/* Avatars stacked overlay */}
                  <div className="flex items-center -space-x-1.5 shrink-0">
                    {typingList.map(([userId, userObj]) => (
                      userObj.avatar ? (
                        <img
                          key={userId}
                          src={userObj.avatar}
                          alt="Typing avatar"
                          className="w-5 h-5 rounded-full object-cover border border-app-sidebar shadow-sm"
                        />
                      ) : (
                        <div
                          key={userId}
                          className="w-5 h-5 rounded-full bg-brand/10 dark:bg-brand/25 border border-app-sidebar flex items-center justify-center text-[9px] text-brand dark:text-white font-bold shadow-sm"
                        >
                          {(userObj.username || "U")[0].toUpperCase()}
                        </div>
                      )
                    ))}
                  </div>

                  {/* Typing Bubble */}
                  <div className="bg-app-input text-app-text-secondary text-xs px-3 py-1.5 rounded-2xl rounded-bl-sm flex items-center gap-2 shadow-sm border border-app-border/40">
                    <span>
                      {typingList.length === 1
                        ? `${typingList[0][1].username} is typing`
                        : typingList.length === 2
                        ? `${typingList[0][1].username} and ${typingList[1][1].username} are typing`
                        : `${typingList.length} people are typing`}
                    </span>
                    {/* Bouncing Dots */}
                    <span className="flex gap-0.5 items-center justify-center h-2 mt-1">
                      <span className="w-1 h-1 bg-app-text-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1 h-1 bg-app-text-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1 h-1 bg-app-text-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* MESSAGE INPUT BOX */}
        {(() => {
          const userRoleObjInWindow = selectedUser.fullChat?.roles?.find((r) => {
            const rUserId = typeof r.user === "object" && r.user !== null ? r.user._id : r.user;
            const currentId = userInfo?.id || userInfo?._id;
            return rUserId?.toString() === currentId?.toString();
          });
          const hasLeftGroupInWindow = selectedUser.isGroupChat && userRoleObjInWindow?.role === "left";

          if (hasLeftGroupInWindow) {
            return (
              <div className="bg-app-input border-t border-app-border py-4 px-6 text-center select-none animate-fade-in flex items-center justify-center gap-2">
                <span className="text-app-text-secondary text-xs font-semibold tracking-wide flex items-center gap-2 px-4 py-2 bg-app-input/40 border border-app-border rounded-xl shadow-inner">
                  <Lock size={14} className="text-app-text-secondary shrink-0" /> You can't send messages to this group because you're no longer a participant.
                </span>
              </div>
            );
          }

          // Private chat blocking check
          const otherParticipant = selectedUser.isGroupChat
            ? null
            : selectedUser.fullChat?.participants?.find((p) => p._id !== (userInfo.id || userInfo._id));

          if (chatPermission && !chatPermission.allowed) {
            // Check if blocked by user or blocked by me
            if (chatPermission.reason === "blocked" && chatPermission.isBlockedByMe) {
              const targetId = otherParticipant?._id || otherParticipant?.id;
              return (
                <div className="bg-app-input border-t border-app-border py-5 px-6 text-center select-none animate-fade-in flex items-center justify-center">
                  <button
                    onClick={async () => {
                      try {
                        await api.post(`/user/unblock/${targetId}`);
                        if (setCurrentUser) {
                          setCurrentUser(prev => ({
                            ...prev,
                            blockedUsers: (prev.blockedUsers || []).filter(id => id.toString() !== targetId.toString())
                          }));
                        }
                        toast.success("✓ Unblocked user");
                        fetchChatPermissions();
                      } catch (error) {
                        console.error(error);
                        toast.error("Failed to unblock user");
                      }
                    }}
                    className="text-amber-500 hover:text-amber-400 text-xs font-semibold tracking-wide flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl hover:bg-amber-500/20 hover:scale-[1.01] active:scale-95 transition-all shadow-inner cursor-pointer"
                  >
                    <Ban size={14} className="text-amber-500 shrink-0" /> You blocked this contact. Tap to unblock.
                  </button>
                </div>
              );
            }

            return (
              <div className="bg-app-input border-t border-app-border py-4 px-6 text-center select-none animate-fade-in flex items-center justify-center gap-2">
                <span className="text-app-text-secondary text-xs font-semibold tracking-wide flex items-center gap-2 px-4 py-2.5 bg-app-input/40 border border-app-border rounded-xl shadow-inner">
                  <Lock size={14} className="text-red-500 shrink-0 animate-pulse" /> {chatPermission.message}
                </span>
              </div>
            );
          }

          return (
            <MessageInput
              selectedUser={selectedUser}
              setMessages={setMessages}
              currentUser={userInfo}
              setChats={setChats}
              replyToMsg={replyToMsg}
              setReplyToMsg={setReplyToMsg}
              uploadQueue={uploadQueue}
              setUploadQueue={setUploadQueue}
            />
          );
        })()}
      </div>

      {/* GROUP DETAILS SIDE DRAWER */}
      {showDrawer && selectedUser.isGroupChat && (
        <GroupDetailsDrawer
          chat={selectedUser.fullChat}
          onlineUsers={onlineUsers}
          onClose={() => setShowDrawer(false)}
          onGroupUpdated={handleGroupUpdated}
          onLeaveGroup={handleLeaveGroupAction}
        />
      )}

      {/* PREMIUM CENTRAL MEDIA VIEWER OVERLAY */}
      <MediaViewer
        isOpen={isMediaViewerOpen}
        onClose={() => {
          setIsMediaViewerOpen(false);
          setSelectedMedia(null);
        }}
        initialMedia={selectedMedia}
        mediaList={allMediaItems}
      />
      {/* CLEAR CHAT CONFIRMATION MODAL */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-app-modal border border-app-border rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-scale-in">
            <h3 className="text-lg font-bold text-app-text-primary mb-2">Clear Chat?</h3>
            <p className="text-sm text-app-text-secondary mb-6 leading-relaxed">
              Are you sure you want to clear all messages in this chat? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-app-text-secondary hover:bg-app-hover rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleClearChatSubmit}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition shadow-md cursor-pointer"
              >
                Clear Messages
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEAVE GROUP CONFIRMATION MODAL */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-app-modal border border-app-border rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-scale-in">
            <h3 className="text-lg font-bold text-app-text-primary mb-2">Leave Group?</h3>
            <p className="text-sm text-app-text-secondary mb-6 leading-relaxed">
              Are you sure you want to leave this group chat? You will no longer be able to participate.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-app-text-secondary hover:bg-app-hover rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleLeaveGroupSubmit}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition shadow-md cursor-pointer"
              >
                Leave Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MUTE NOTIFICATIONS DIALOG */}
      {showMuteModal && (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-app-modal border border-app-border rounded-2xl max-w-xs w-full p-6 shadow-2xl animate-scale-in">
            <h3 className="text-base font-bold text-app-text-primary mb-4">Mute Notifications</h3>
            <div className="space-y-1.5 mb-6">
              {[
                { label: "8 Hours", val: 8 },
                { label: "1 Week", val: 7 * 24 },
                { label: "Always", val: "always" }
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => handleMute(opt.val)}
                  className="w-full text-left px-4 py-2.5 hover:bg-app-hover rounded-xl text-sm font-medium text-app-text-primary transition flex items-center justify-between cursor-pointer"
                >
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowMuteModal(false)}
                className="px-4 py-2 text-xs font-semibold text-app-text-secondary hover:bg-app-hover rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* BLOCK CONTACT CONFIRMATION MODAL */}
      {showBlockConfirm && (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-app-modal border border-app-border rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-scale-in">
            <h3 className="text-lg font-bold text-app-text-primary mb-2">Block Contact?</h3>
            <p className="text-sm text-app-text-secondary mb-6 leading-relaxed">
              Are you sure you want to block {selectedUser.username}? You will not be able to send or receive messages from them.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowBlockConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-app-text-secondary hover:bg-app-hover rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleBlockContactSubmit}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition shadow-md cursor-pointer"
              >
                Block User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECURE PASSCODE PIN MODAL */}
      {passcodePrompt && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 backdrop-blur-md animate-fade-in p-4">
          <div className="bg-app-modal border border-app-border rounded-2xl w-[90%] max-w-sm p-6 shadow-2xl text-center flex flex-col items-center animate-scale-in">
            <Lock size={36} className="text-brand mb-3 animate-pulse" />
            <h3 className="text-lg font-semibold text-app-text-primary mt-1 mb-2">
              {passcodePrompt.type === "lock" ? "Set Chat Lock Passcode" : "Unlock Locked Chat"}
            </h3>
            <p className="text-xs text-app-text-secondary mb-6 leading-relaxed">
              {passcodePrompt.type === "lock"
                ? "Create a 4-digit security PIN to restrict access to this conversation."
                : "Enter your 4-digit security PIN to continue."}
            </p>
            
            <input
              type="password"
              maxLength={4}
              value={passcodeValue}
              onChange={(e) => setPasscodeValue(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="w-32 bg-app-input border border-app-border rounded-xl px-4 py-3 text-center text-app-text-primary text-2xl font-bold tracking-widest outline-none mb-6 focus:border-brand transition"
              autoFocus
            />
            
            <div className="flex justify-center gap-3">
              <button
                onClick={() => {
                  setPasscodePrompt(null);
                  setPasscodeValue("");
                }}
                className="px-4 py-2 rounded-xl bg-transparent border border-app-border text-app-text-secondary hover:bg-app-hover transition-all text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyPasscode}
                className="px-6 py-2 rounded-xl bg-brand hover:bg-brand/80 text-white font-bold transition-all text-xs shadow-md"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatWindow;
