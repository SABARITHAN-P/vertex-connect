import { useState, useRef, useEffect } from "react";
import { SendHorizonal, Smile, Paperclip, Mic, X } from "lucide-react";
import imageCompression from "browser-image-compression";
import api from "@services/api";
import { socket } from "@socket/socket";
import AttachmentMenu from "@components/features/media/AttachmentMenu";
import MediaPreviewModal from "@components/features/media/MediaPreviewModal";
import VoiceRecorder from "@components/features/chat/VoiceRecorder";
import CreatePollModal from "@components/features/group/CreatePollModal";
import MediaPanel from "@components/features/media/MediaPanel";
import { useEscapeKey } from "@hooks/useEscapeKey";
import { useTheme } from "@context/ThemeContext";
import { playSentSound } from "@utils/soundHelper";

function MessageInput({ selectedUser, setMessages, currentUser, setChats, replyToMsg, setReplyToMsg, setUploadQueue }) {
  const { enterToSend, soundsEnabled } = useTheme();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);

  // Centralized ESC handling in MessageInput
  useEscapeKey(() => setShowEmojiPicker(false), showEmojiPicker, 15);
  useEscapeKey(() => setShowAttachmentMenu(false), showAttachmentMenu, 15);
  useEscapeKey(() => setReplyToMsg(null), replyToMsg !== null && !showEmojiPicker && !showAttachmentMenu, 10);
  useEscapeKey(() => setIsRecording(false), isRecording, 10);

  const typingTimeoutRef = useRef(null);
  const imageVideoInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const attachmentMenuRef = useRef(null);
  const attachmentButtonRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (replyToMsg && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyToMsg]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(event.target)
      ) {
        setShowEmojiPicker(false);
      }

      if (
        attachmentMenuRef.current &&
        !attachmentMenuRef.current.contains(event.target) &&
        attachmentButtonRef.current &&
        !attachmentButtonRef.current.contains(event.target)
      ) {
        setShowAttachmentMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);



  const detectMessageType = (mimeType) => {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    return "file";
  };

  const updateSidebarLatestMessage = (latestMessage) => {
    setChats((prev) => {
      const chatExists = prev.some((chat) => chat._id === selectedUser.chatId.toString());
      if (!chatExists) {
        api.get("/chat")
          .then((res) => {
            if (res.data) setChats(res.data);
          })
          .catch((err) => console.error("Failed to restore chats:", err));
        return prev;
      }

      const updatedChats = prev.map((chat) => {
        if (chat._id === selectedUser.chatId.toString()) {
          return { ...chat, lastMessage: latestMessage };
        }
        return chat;
      });
      updatedChats.sort((a, b) => {
        if (a._id === selectedUser.chatId.toString()) return -1;
        if (b._id === selectedUser.chatId.toString()) return 1;
        return 0;
      });
      return updatedChats;
    });
  };

  const typingHandler = (e) => {
    const value = e.target.value;
    setMessage(value);

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }

    if (!typing) {
      setTyping(true);
      if (selectedUser.isGroupChat) {
        socket.emit("group:typing-start", {
          chatId: selectedUser.chatId,
          senderId: (currentUser.id || currentUser._id),
          senderName: currentUser.username,
          senderAvatar: currentUser.avatar,
        });
      } else {
        socket.emit("typing", {
          chatId: selectedUser.chatId,
          receiverId: selectedUser._id,
          senderName: currentUser.username,
          senderId: (currentUser.id || currentUser._id),
          senderAvatar: currentUser.avatar,
        });
      }
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (selectedUser.isGroupChat) {
        socket.emit("group:typing-stop", {
          chatId: selectedUser.chatId,
          senderId: (currentUser.id || currentUser._id),
        });
      } else {
        socket.emit("stopTyping", {
          chatId: selectedUser.chatId,
          receiverId: selectedUser._id,
          senderId: (currentUser.id || currentUser._id),
        });
      }
      setTyping(false);
    }, 1500);
  };

  const buildReplyToObj = () => {
    if (!replyToMsg) return undefined;
    const senderName = replyToMsg.sender?.username || (typeof replyToMsg.sender === "object" ? replyToMsg.sender.username : "User");
    const senderId = replyToMsg.sender?._id || replyToMsg.sender;

    let mediaThumbnail = "";
    if (replyToMsg.media && replyToMsg.media.length > 0) {
      mediaThumbnail = replyToMsg.media[0].thumbnailUrl || replyToMsg.media[0].url || "";
    } else if (replyToMsg.thumbnailUrl) {
      mediaThumbnail = replyToMsg.thumbnailUrl;
    } else if (replyToMsg.mediaUrl) {
      mediaThumbnail = replyToMsg.mediaUrl;
    }

    return {
      messageId: replyToMsg._id,
      senderId,
      senderName,
      text: replyToMsg.content || replyToMsg.caption || (replyToMsg.messageType !== "text" ? `[${replyToMsg.messageType}]` : "Media Attachment"),
      messageType: replyToMsg.messageType,
      mediaThumbnail,
    };
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    const messageToSend = message;

    try {
      setLoading(true);
      setMessage("");
      setReplyToMsg(null); // clear reply

      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }

      if (soundsEnabled) {
        playSentSound();
      }

      clearTimeout(typingTimeoutRef.current);
      if (selectedUser.isGroupChat) {
        socket.emit("group:typing-stop", {
          chatId: selectedUser.chatId,
          senderId: currentUser.id,
        });
      } else {
        socket.emit("stopTyping", {
          chatId: selectedUser.chatId,
          receiverId: selectedUser._id,
          senderId: currentUser.id,
        });
      }
      setTyping(false);

      const { data } = await api.post("/message", {
        chatId: selectedUser.chatId,
        content: messageToSend,
        messageType: "text",
        replyTo: buildReplyToObj(),
      });

      setMessages((prev) => [...prev, data]);
      updateSidebarLatestMessage(data);
    } catch (error) {
      console.log(error);
      setMessage(messageToSend);
    } finally {
      setLoading(false);
    }
  };

  const handleSendPoll = async (pollData) => {
    try {
      const { data } = await api.post("/message", {
        chatId: selectedUser.chatId,
        poll: pollData,
        messageType: "poll",
      });
      setMessages((prev) => [...prev, data]);
      updateSidebarLatestMessage(data);
    } catch (err) {
      console.error(err);
    }
  };



  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const MAX_SIZE = 100 * 1024 * 1024;
    const oversizedFile = files.find((file) => file.size > MAX_SIZE);
    if (oversizedFile) {
      alert(`${oversizedFile.name} exceeds 100MB limit`);
      return;
    }

    setShowAttachmentMenu(false);
    setSelectedFiles(files);
    e.target.value = "";
  };

  const startUploadFlow = async (tempId, files, caption, peaks = []) => {
    // 1. Mark upload queue as starting
    setUploadQueue((prev) => ({
      ...prev,
      [tempId]: {
        progress: 0,
        status: "uploading",
        retryFn: () => startUploadFlow(tempId, files, caption, peaks),
      },
    }));

    socket.emit("message:upload-started", {
      chatId: selectedUser.chatId,
      tempId,
      senderId: (currentUser.id || currentUser._id),
    });

    try {
      // 2. Perform image compression in background thread (inside the promise)
      const processedFiles = await Promise.all(
        files.map(async (file) => {
          let finalFile = file;
          if (file.type.startsWith("image/")) {
            try {
              finalFile = await imageCompression(file, {
                maxSizeMB: 1.5,
                maxWidthOrHeight: 1920,
                useWebWorker: true,
              });
            } catch (err) {
              console.error("Compression failed, using original file", err);
            }
          }
          return finalFile;
        })
      );

      // 3. Perform file upload
      const formData = new FormData();
      processedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const uploadRes = await api.post("/upload", formData, {
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);

          setUploadQueue((prev) => ({
            ...prev,
            [tempId]: {
              ...prev[tempId],
              progress: percent,
            },
          }));

          socket.emit("message:upload-progress", {
            chatId: selectedUser.chatId,
            tempId,
            progress: percent,
          });
        },
      });

      // Attach visual peaks metadata back to audio/voice media properties
      const uploadedMedia = uploadRes.data.media.map((m) => {
        if (m.type === "audio" && peaks && peaks.length > 0) {
          return { ...m, peaks };
        }
        return m;
      });

      // 4. Send actual chat message to database
      const { data } = await api.post("/message", {
        chatId: selectedUser.chatId,
        content: caption,
        caption: caption,
        media: uploadedMedia,
        messageType: processedFiles.length === 1 ? detectMessageType(processedFiles[0].type) : "media",
        replyTo: buildReplyToObj(),
      });

      // 5. Replace optimistic message with final message in state
      setMessages((prev) => prev.map((msg) => (msg._id === tempId ? data : msg)));
      updateSidebarLatestMessage(data);

      setUploadQueue((prev) => {
        const next = { ...prev };
        delete next[tempId];
        return next;
      });

      if (soundsEnabled) {
        playSentSound();
      }

      socket.emit("message:upload-complete", {
        chatId: selectedUser.chatId,
        tempId,
        message: data,
      });

    } catch (err) {
      console.error("Upload failed", err);

      setUploadQueue((prev) => ({
        ...prev,
        [tempId]: {
          ...prev[tempId],
          status: "failed",
          error: err?.response?.data?.message || "Upload failed",
        },
      }));

      socket.emit("message:upload-failed", {
        chatId: selectedUser.chatId,
        tempId,
        error: err?.response?.data?.message || "Upload failed",
      });
    }
  };

  const uploadAndSendFiles = (files, caption = "", peaks = []) => {
    // Instant optimistic render of the preview
    const processedFiles = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      type: detectMessageType(file.type),
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    }));

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      optimistic: true,
      sender: { _id: (currentUser.id || currentUser._id), username: currentUser.username },
      createdAt: new Date(),
      content: caption,
      caption: caption,
      messageType: processedFiles.length === 1 ? processedFiles[0].type : "media",
      media: processedFiles.map((item) => ({
        url: item.previewUrl,
        type: item.type,
        fileName: item.fileName,
        fileSize: item.fileSize,
        mimeType: item.mimeType,
        peaks: peaks,
      })),
      reactions: [],
      messageStatus: [],
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setSelectedFiles([]);
    setReplyToMsg(null);

    // Trigger the background upload flow asynchronously without blocking UI!
    startUploadFlow(tempId, files, caption, peaks);
  };

  return (
    <>
      {selectedFiles.length > 0 && (
        <MediaPreviewModal
          files={selectedFiles}
          onClose={() => setSelectedFiles([])}
          onSend={(files, caption) => uploadAndSendFiles(files, caption)}
        />
      )}

      {/* INPUT CONTAINER */}
      <div className="relative bg-app-header flex flex-col border-t border-app-border text-app-text-primary">
        {/* REPLY PREVIEW BAR */}
        {replyToMsg && (
          <div className="bg-app-hover px-4 py-2 flex items-center justify-between border-l-[4px] border-brand animate-fade-in">
            <div className="flex-1 min-w-0 pr-3">
              <span className="text-brand text-[10px] font-bold uppercase tracking-wider block">
                Replying to {replyToMsg.sender?.username || "User"}
              </span>
              <p className="text-app-text-secondary text-xs truncate max-w-lg mt-0.5">
                {replyToMsg.content || replyToMsg.caption || (replyToMsg.messageType !== "text" ? `[${replyToMsg.messageType}]` : "Media Attachment")}
              </p>
            </div>

            {/* THUMBNAIL IF MEDIA */}
            {(replyToMsg.thumbnailUrl || replyToMsg.mediaUrl || (replyToMsg.media && replyToMsg.media.length > 0)) && (
              <img
                src={replyToMsg.media?.[0]?.thumbnailUrl || replyToMsg.media?.[0]?.url || replyToMsg.thumbnailUrl || replyToMsg.mediaUrl}
                alt="Media thumbnail"
                className="w-8 h-8 object-cover rounded bg-black/30 shrink-0 mr-2 border border-white/5"
              />
            )}

            <button
              onClick={() => setReplyToMsg(null)}
              className="text-app-text-secondary hover:text-app-text-primary p-1.5 hover:bg-app-hover rounded-full transition shrink-0"
            >
              <X size={15} />
            </button>
          </div>
        )}

        <div className="px-4 py-3 flex items-center gap-3">
          {isRecording ? (
            <VoiceRecorder
              onSend={(file, duration, peaks) => {
                setIsRecording(false);
                uploadAndSendFiles([file], "", peaks);
              }}
              onCancel={() => setIsRecording(false)}
            />
          ) : (
            <>
              {/* INTEGRATED EMOJI MEDIA PANEL */}
              {showEmojiPicker && (
                <div ref={emojiPickerRef} className="absolute bottom-16 left-4 z-50">
                  <MediaPanel
                    onEmojiSelect={(emoji) => setMessage((prev) => prev + emoji)}
                    onClose={() => setShowEmojiPicker(false)}
                  />
                </div>
              )}

              {/* ATTACHMENT MENU */}
              {showAttachmentMenu && (
                <div ref={attachmentMenuRef}>
                  <AttachmentMenu
                    closeMenu={() => setShowAttachmentMenu(false)}
                    onImageVideoClick={() => imageVideoInputRef.current.click()}
                    onDocumentClick={() => documentInputRef.current.click()}
                    onAudioClick={() => audioInputRef.current.click()}
                    showPoll={selectedUser.isGroupChat}
                    onPollClick={() => {
                      setShowPollCreator(true);
                      setShowAttachmentMenu(false);
                    }}
                  />
                </div>
              )}

              <button
                ref={emojiButtonRef}
                onClick={() => {
                  setShowEmojiPicker(!showEmojiPicker);
                  setShowAttachmentMenu(false);
                }}
                className="text-app-text-secondary hover:text-app-text-primary shrink-0"
              >
                <Smile size={24} />
              </button>

              <button
                ref={attachmentButtonRef}
                onClick={() => {
                  setShowAttachmentMenu(!showAttachmentMenu);
                  setShowEmojiPicker(false);
                }}
                className="text-app-text-secondary hover:text-app-text-primary shrink-0"
              >
                <Paperclip size={22} />
              </button>

              <input
                type="file"
                hidden
                multiple
                ref={imageVideoInputRef}
                accept="image/*,video/*"
                onChange={handleFileSelect}
              />
              <input
                type="file"
                hidden
                multiple
                ref={documentInputRef}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip"
                onChange={handleFileSelect}
              />
              <input
                type="file"
                hidden
                multiple
                ref={audioInputRef}
                accept="audio/*"
                onChange={handleFileSelect}
              />

              <textarea
                ref={inputRef}
                placeholder="Type a message"
                value={message}
                onChange={typingHandler}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    if (enterToSend) {
                      e.preventDefault();
                      handleSend();
                    }
                  }
                }}
                rows={1}
                className="flex-1 bg-app-drawer border border-app-border text-app-text-primary rounded-lg px-4 py-3.5 text-sm outline-none placeholder-app-text-secondary resize-none max-h-[120px] overflow-y-auto align-middle leading-normal scrollbar-none"
                style={{ height: "auto" }}
              />


              {message.trim() ? (
                <button onClick={handleSend} disabled={loading} className="bg-brand hover:opacity-90 p-3 rounded-full transition shrink-0 shadow-md">
                  <SendHorizonal size={20} className="text-white" />
                </button>
              ) : (
                <button onClick={() => setIsRecording(true)} disabled={loading} className="bg-brand hover:opacity-90 p-3 rounded-full transition shrink-0 shadow-md">
                  <Mic size={20} className="text-white" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {showPollCreator && (
        <CreatePollModal
          onClose={() => setShowPollCreator(false)}
          onSend={handleSendPoll}
        />
      )}


    </>
  );
}

export default MessageInput;
