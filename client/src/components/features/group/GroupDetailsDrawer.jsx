/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect, react-hooks/immutability, react-hooks/purity, react-hooks/exhaustive-deps */
import { useState, useEffect, useRef } from "react";
import { X, Users, Image as ImageIcon, Calendar, Shield, Trash, LogOut, Check, Sparkles, Copy, AlertCircle, Plus, Clock, Camera, Edit2, Lock, File } from "lucide-react";
import api from "@services/api";
import ImageEditorModal from "@components/features/media/ImageEditorModal";
import { useEscapeKey } from "@hooks/useEscapeKey";

function GroupDetailsDrawer({ chat, onlineUsers = [], onClose, onGroupUpdated, onLeaveGroup }) {
  const [activeTab, setActiveTab] = useState("members");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [groupName, setGroupName] = useState(chat.chatName);
  const [groupDesc, setGroupDesc] = useState(chat.groupDescription || "");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedMemberAction, setSelectedMemberAction] = useState(null);

  // Centralized ESC key support: close sidebar on Escape. Priority: 5 (lower than modals)
  useEscapeKey(onClose, !isEditorOpen, 5);
  
  useEffect(() => {
    setGroupName(chat.chatName);
    setGroupDesc(chat.groupDescription || "");
  }, [chat]);

  const groupFileRef = useRef(null);

  // Members Tab
  const [inviteCode, setInviteCode] = useState("");
  const [usersToInvite, setUsersToInvite] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInviteResults, setSearchInviteResults] = useState([]);
  const [approveJoins, setApproveJoins] = useState(chat.approveJoins);

  const [selectedUsersToAdd, setSelectedUsersToAdd] = useState([]);

  // Media Tab
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaTab, setMediaTab] = useState("images");

  // Events Tab
  const [events, setEvents] = useState([]);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [eventDate, setEventDate] = useState("");

  // Settings Tab
  const [mutedUntil, setMutedUntil] = useState("unmuted");
  const [mutedForever, setMutedForever] = useState(false);
  const [mentionsOnly, setMentionsOnly] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem("userInfo"));

  const userRoleObj = chat.roles?.find((r) => {
    const rUserId = typeof r.user === "object" && r.user !== null ? r.user._id : r.user;
    const currentId = currentUser?.id || currentUser?._id;
    return rUserId?.toString() === currentId?.toString();
  });
  const userRole = userRoleObj ? userRoleObj.role : "member";
  const isOwner = userRole === "owner";
  const isAdmin = ["owner", "admin", "moderator"].includes(userRole);

  const canEditGroupInfo = () => {
    if (userRole === "left") return false;
    if (isOwner) return true;
    const ruleVal = chat.rules?.editGroupInfo || "everyone";
    if (ruleVal === "everyone") return true;
    return userRole === "admin" || userRole === "moderator";
  };

  const canEditProfilePhoto = () => {
    if (userRole === "left") return false;
    if (isOwner) return true;
    const ruleVal = chat.rules?.editProfilePhoto || "everyone";
    if (ruleVal === "everyone") return true;
    return userRole === "admin" || userRole === "moderator";
  };

  const canAddMembers = () => {
    if (userRole === "left") return false;
    if (isOwner) return true;
    const ruleVal = chat.rules?.addMembers || "everyone";
    if (ruleVal === "everyone") return true;
    return userRole === "admin" || userRole === "moderator";
  };

  // Rules Tab states
  const [editGroupInfoRule, setEditGroupInfoRule] = useState(chat.rules?.editGroupInfo || "everyone");
  const [editProfilePhotoRule, setEditProfilePhotoRule] = useState(chat.rules?.editProfilePhoto || "everyone");
  const [addMembersRule, setAddMembersRule] = useState(chat.rules?.addMembers || "everyone");

  useEffect(() => {
    if (chat.rules) {
      setEditGroupInfoRule(chat.rules.editGroupInfo || "everyone");
      setEditProfilePhotoRule(chat.rules.editProfilePhoto || "everyone");
      setAddMembersRule(chat.rules.addMembers || "everyone");
    }
  }, [chat]);

  const handleSaveRules = async () => {
    try {
      setLoading(true);
      const { data } = await api.put("/chat/group/rules", {
        chatId: chat._id,
        editGroupInfo: editGroupInfoRule,
        editProfilePhoto: editProfilePhotoRule,
        addMembers: addMembersRule,
      });
      onGroupUpdated(data);
      showFeedback(setSuccess, "Group rules updated successfully!");
    } catch (err) {
      showFeedback(setError, err.response?.data?.message || "Failed to update rules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "media") {
      fetchMedia();
    } else if (activeTab === "events") {
      fetchEvents();
    }
  }, [activeTab]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const searchUsers = async () => {
        try {
          const { data } = await api.get(`/user/search?query=${searchQuery}`);
          // Filter out existing members
          const filtered = data.filter((u) => !chat.participants.some((p) => p._id === u._id));
          setSearchInviteResults(filtered);
        } catch (err) {
          console.error(err);
        }
      };
      searchUsers();
    } else {
      setSearchInviteResults([]);
    }
  }, [searchQuery, chat.participants]);

  const handleGroupAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showFeedback(setError, "Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImageSrc(reader.result);
      setIsEditorOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSaveGroupCrop = async (croppedBlob) => {
    setIsEditorOpen(false);
    setAvatarLoading(true);
    setUploadProgress(20);

    const formData = new FormData();
    formData.append("avatar", croppedBlob, "group-avatar.jpg");
    formData.append("chatId", chat._id);

    try {
      setUploadProgress(50);
      const { data } = await api.put("/chat/group/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadProgress(90);
      onGroupUpdated(data);
      setUploadProgress(100);
      showFeedback(setSuccess, "Group avatar updated successfully");
    } catch (err) {
      console.error(err);
      showFeedback(setError, err.response?.data?.message || "Failed to update group avatar");
    } finally {
      setTimeout(() => {
        setAvatarLoading(false);
        setUploadProgress(0);
      }, 500);
    }
  };

  const handleSaveGroupName = async () => {
    if (!groupName.trim()) return;
    try {
      const { data } = await api.put("/chat/group/info", {
        chatId: chat._id,
        chatName: groupName.trim(),
      });
      onGroupUpdated(data);
      setIsEditingName(false);
      showFeedback(setSuccess, "Group name updated successfully");
    } catch (err) {
      showFeedback(setError, err.response?.data?.message || "Failed to update group name");
    }
  };

  const handleSaveGroupDesc = async () => {
    try {
      const { data } = await api.put("/chat/group/info", {
        chatId: chat._id,
        groupDescription: groupDesc.trim(),
      });
      onGroupUpdated(data);
      setIsEditingDesc(false);
      showFeedback(setSuccess, "Group description updated successfully");
    } catch (err) {
      showFeedback(setError, err.response?.data?.message || "Failed to update group description");
    }
  };

  const handleRemoveGroupAvatar = async () => {
    if (!confirm("Are you sure you want to remove the group avatar?")) return;
    setAvatarLoading(true);
    try {
      const { data } = await api.delete("/chat/group/avatar", {
        data: { chatId: chat._id },
      });
      onGroupUpdated(data);
      showFeedback(setSuccess, "Group avatar removed");
    } catch (err) {
      console.error(err);
      showFeedback(setError, err.response?.data?.message || "Failed to remove group avatar");
    } finally {
      setAvatarLoading(false);
    }
  };

  const showFeedback = (setter, text) => {
    setter(text);
    setTimeout(() => setter(""), 3000);
  };

  /* =========================
     MEMBERS METHODS
  ========================== */

  const handleAddSelectedMembers = async () => {
    if (selectedUsersToAdd.length === 0) return;
    const usernames = selectedUsersToAdd.map((u) => u.username).join(", ");
    if (!confirm(`Are you sure you want to add these users to the group?\n\n${usernames}`)) {
      return;
    }

    setLoading(true);
    let successCount = 0;
    let lastUpdatedData = null;

    for (const userObj of selectedUsersToAdd) {
      try {
        const { data } = await api.post("/chat/group/add", { chatId: chat._id, userId: userObj._id });
        lastUpdatedData = data;
        successCount++;
      } catch (err) {
        console.error(`Failed to add ${userObj.username}:`, err);
      }
    }

    setLoading(false);
    if (lastUpdatedData) {
      onGroupUpdated(lastUpdatedData);
    }

    if (successCount === selectedUsersToAdd.length) {
      showFeedback(setSuccess, `Added ${successCount} member(s) successfully`);
    } else if (successCount > 0) {
      showFeedback(setSuccess, `Added ${successCount} out of ${selectedUsersToAdd.length} members`);
    } else {
      showFeedback(setError, "Failed to add selected members");
    }

    setSelectedUsersToAdd([]);
    setSearchQuery("");
  };

  const handleRemoveMember = async (userId) => {
    try {
      const { data } = await api.post("/chat/group/remove", { chatId: chat._id, userId });
      onGroupUpdated(data);
      showFeedback(setSuccess, "Member removed successfully");
    } catch (err) {
      showFeedback(setError, err.response?.data?.message || "Failed to remove member");
    }
  };

  const handleLeaveGroup = async () => {
    const hasLeftGroup = userRole === "left";
    if (hasLeftGroup) {
      if (!confirm("Are you sure you want to delete this group chat? This will remove the chat history and the group from your sidebar permanently.")) return;
    } else {
      if (!confirm("Are you sure you want to exit this group? You will no longer be able to send or receive messages in this chat.")) return;
    }

    try {
      await api.post("/chat/group/leave", { chatId: chat._id });
      onLeaveGroup(chat._id);
    } catch (err) {
      showFeedback(setError, hasLeftGroup ? "Failed to delete group chat" : "Failed to leave group");
    }
  };

  const handleLeaveAndDeleteGroup = async () => {
    if (!confirm("Are you sure you want to exit and completely delete this group chat from your sidebar? The group will continue to run for other members, but it will be permanently removed for you.")) return;

    try {
      setLoading(true);
      await api.post("/chat/group/leave", { chatId: chat._id, deleteChat: true });
      onLeaveGroup(chat._id);
    } catch (err) {
      showFeedback(setError, err.response?.data?.message || "Failed to exit and delete group");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (targetUserId, newRole) => {
    try {
      const { data } = await api.put("/chat/group/role", {
        chatId: chat._id,
        userId: targetUserId,
        role: newRole,
      });
      onGroupUpdated(data);
      showFeedback(setSuccess, "Role updated successfully");
    } catch (err) {
      showFeedback(setError, err.response?.data?.message || "Failed to change role");
    }
  };

  const handleTransferOwnership = async (targetUserId) => {
    try {
      const { data } = await api.put("/chat/group/transfer", {
        chatId: chat._id,
        userId: targetUserId,
      });
      onGroupUpdated(data);
      showFeedback(setSuccess, "Ownership transferred successfully");
    } catch (err) {
      showFeedback(setError, err.response?.data?.message || "Failed to transfer ownership");
    }
  };

  const handleApproveJoinToggle = async (e) => {
    const val = e.target.checked;
    setApproveJoins(val);
    try {
      const { data } = await api.put("/chat/group/info", {
        chatId: chat._id,
        approveJoins: val,
      });
      onGroupUpdated(data);
    } catch (err) {
      showFeedback(setError, "Failed to update settings");
    }
  };

  const handleApproveRequest = async (targetUserId, approve) => {
    try {
      const { data } = await api.post("/chat/group/approve-join", {
        chatId: chat._id,
        targetUserId,
        approve,
      });
      onGroupUpdated(data);
      showFeedback(setSuccess, approve ? "Request approved" : "Request rejected");
    } catch (err) {
      showFeedback(setError, "Failed to process request");
    }
  };

  /* =========================
     MEDIA METHODS
  ========================== */
  const fetchMedia = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/message/media/${chat._id}`);
      setMediaFiles(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredMedia = () => {
    return mediaFiles.filter((msg) => {
      const allFiles = msg.media?.length ? msg.media : [{ url: msg.mediaUrl, type: msg.messageType, mimeType: "" }];
      return allFiles.some((item) => {
        if (mediaTab === "images") return item.type === "image" || item.mimeType?.startsWith("image");
        if (mediaTab === "videos") return item.type === "video" || item.mimeType?.startsWith("video");
        if (mediaTab === "documents") return item.type === "file" || (!item.type?.startsWith("image") && !item.type?.startsWith("video") && !item.type?.startsWith("audio"));
        return false;
      });
    });
  };

  /* =========================
     EVENTS METHODS
  ========================== */
  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/event/${chat._id}`);
      setEvents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!eventTitle.trim() || !eventDate) return;

    try {
      const { data } = await api.post("/event", {
        chatId: chat._id,
        title: eventTitle,
        description: eventDesc,
        eventDate,
      });
      setEvents([...events, data]);
      setEventTitle("");
      setEventDesc("");
      setEventDate("");
      showFeedback(setSuccess, "Event scheduled successfully");
    } catch (err) {
      showFeedback(setError, "Failed to schedule event");
    }
  };

  const handleEventRSVP = async (eventId) => {
    try {
      const { data } = await api.put(`/event/attend/${eventId}`);
      setEvents(events.map((ev) => (ev._id === eventId ? data : ev)));
    } catch (err) {
      console.error(err);
    }
  };

  /* =========================
     SETTINGS METHODS
  ========================== */
  const handleSaveNotifications = async () => {
    try {
      let mutingTime = null;
      if (mutedUntil === "8h") {
        mutingTime = new Date(Date.now() + 8 * 60 * 60 * 1000);
      } else if (mutedUntil === "1w") {
        mutingTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      }

      await api.put("/chat/group/notifications", {
        chatId: chat._id,
        mutedUntil: mutingTime,
        mutedForever: mutedUntil === "forever",
        mentionsOnly,
      });

      showFeedback(setSuccess, "Notification preferences updated");
    } catch (err) {
      showFeedback(setError, "Failed to update notification configuration");
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-app-drawer border-l border-app-border text-app-text-primary shadow-2xl flex flex-col animate-slide-in">
      {/* DRAWER HEADER */}
      <div className="h-[60px] bg-app-header flex items-center justify-between px-4 border-b border-app-border">
        <h2 className="text-app-text-primary font-medium text-base tracking-wide flex items-center gap-2">
          <Users size={18} className="text-brand" /> Group Info
        </h2>
        <button onClick={onClose} className="text-app-text-secondary hover:text-app-text-primary transition">
          <X size={20} />
        </button>
      </div>

      {/* BODY CONTAINER */}
      <div className="flex-1 overflow-y-auto">
        {/* GROUP HEADER METADATA */}
        <div className="flex flex-col items-center py-6 px-4 bg-app-header/20 border-b border-app-border">
          <div 
            onClick={() => {
              if (canEditProfilePhoto() && !avatarLoading) {
                groupFileRef.current?.click();
              }
            }}
            className={`relative group w-24 h-24 rounded-full overflow-hidden flex items-center justify-center bg-brand border-2 border-brand/40 hover:border-white transition-all ${
              canEditProfilePhoto() ? "cursor-pointer" : ""
            }`}
          >
            {chat.groupAvatar ? (
              <img
                src={chat.groupAvatar}
                alt="Group Avatar"
                className="w-full h-full object-cover group-hover:opacity-40 transition-opacity"
              />
            ) : (
              <span className="text-white text-3xl font-bold group-hover:opacity-40 transition-opacity">
                {chat.chatName ? chat.chatName.charAt(0).toUpperCase() : "G"}
              </span>
            )}

            {/* ADMIN HOVER CAMERA OVERLAY */}
            {canEditProfilePhoto() && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-center px-1"
                title="Change Group Photo"
              >
                <Camera size={20} className="text-white animate-pulse" />
                <span className="text-[8px] text-white uppercase font-bold tracking-wider mt-0.5">
                  Change Photo
                </span>
              </div>
            )}

            {/* LOADING STATE */}
            {avatarLoading && (
              <div className="absolute inset-0 bg-[#111b21]/80 flex flex-col items-center justify-center gap-1">
                <div className="w-6 h-6 border-3 border-brand border-t-transparent rounded-full animate-spin"></div>
                {uploadProgress > 0 && (
                  <span className="text-[9px] text-white font-semibold">{uploadProgress}%</span>
                )}
              </div>
            )}
          </div>

          <input
            type="file"
            ref={groupFileRef}
            onChange={handleGroupAvatarChange}
            accept="image/*"
            className="hidden"
          />

          {/* REMOVE GROUP AVATAR BUTTON FOR ADMINS */}
          {canEditProfilePhoto() && chat.groupAvatar && !avatarLoading && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveGroupAvatar();
              }}
              className="text-red-400 hover:text-red-300 text-[10px] font-bold uppercase tracking-wider bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 rounded-full transition mt-2"
            >
              Remove Photo
            </button>
          )}

          {/* GROUP NAME EDIT ZONE */}
          {isEditingName ? (
            <div className="flex items-center gap-1.5 mt-3 border-b border-brand pb-1 w-full max-w-[280px]">
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                maxLength={25}
                className="bg-transparent text-white font-semibold text-base outline-none w-full text-center"
                autoFocus
              />
              <button onClick={handleSaveGroupName} className="text-gray-400 hover:text-white transition">
                <Check size={18} className="text-brand" />
              </button>
              <button
                onClick={() => {
                  setGroupName(chat.chatName);
                  setIsEditingName(false);
                }}
                className="text-gray-400 hover:text-white transition"
              >
                <X size={18} className="text-red-400" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-3 justify-center">
              <h1 className="text-white text-lg font-semibold text-center">{chat.chatName}</h1>
              {canEditGroupInfo() && (
                <button
                  onClick={() => setIsEditingName(true)}
                  className="text-gray-400 hover:text-white p-1 hover:bg-[#111b21] rounded-full transition"
                >
                  <Edit2 size={13} />
                </button>
              )}
            </div>
          )}

          <p className="text-gray-400 text-xs mt-1 text-center font-semibold tracking-wide">
            {chat.roles?.filter((r) => r.role !== "left")?.length || 0} members
          </p>
          <p className="text-gray-500 text-[10px] mt-1 text-center font-medium">
            Created on {chat.createdAt ? new Date(chat.createdAt).toLocaleDateString("en-US", { day: 'numeric', month: 'short', year: 'numeric' }) : "Recently"} • by {chat.creator?.username || "Admin"}
          </p>

          {/* GROUP DESCRIPTION EDIT ZONE */}
          {isEditingDesc ? (
            <div className="flex items-center gap-1.5 mt-3 border-b border-brand pb-1 w-full px-4">
              <textarea
                value={groupDesc}
                onChange={(e) => setGroupDesc(e.target.value)}
                maxLength={200}
                rows={2}
                className="bg-transparent text-gray-300 text-xs outline-none w-full resize-none italic text-center"
                autoFocus
              />
              <button onClick={handleSaveGroupDesc} className="text-gray-400 hover:text-white transition self-end pb-1">
                <Check size={18} className="text-brand" />
              </button>
              <button
                onClick={() => {
                  setGroupDesc(chat.groupDescription || "");
                  setIsEditingDesc(false);
                }}
                className="text-gray-400 hover:text-white transition self-end pb-1"
              >
                <X size={18} className="text-red-400" />
              </button>
            </div>
          ) : (
            <div 
              onClick={() => {
                if (canEditGroupInfo()) {
                  setIsEditingDesc(true);
                }
              }}
              className={`flex items-start gap-2 mt-3 bg-app-modal px-4 py-2.5 rounded-lg w-full justify-center border border-app-border ${
                canEditGroupInfo() ? "cursor-pointer hover:border-brand/40" : ""
              } transition-colors`}
            >
              <p className="text-gray-300 text-xs text-center italic leading-relaxed break-words max-w-[90%]">
                {chat.groupDescription ? `"${chat.groupDescription}"` : "No group description provided"}
              </p>
              {canEditGroupInfo() && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditingDesc(true);
                  }}
                  className="text-gray-400 hover:text-white p-1 hover:bg-[#202c33] rounded-full transition shrink-0"
                >
                  <Edit2 size={13} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* FEEDBACK STATUS */}
        {error && (
          <div className="mx-4 mt-3 bg-red-500/10 border border-red-500/20 text-red-400 px-3.5 py-2.5 rounded-lg flex items-center gap-2 text-xs">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mx-4 mt-3 bg-brand/10 border border-brand/20 text-brand px-3.5 py-2.5 rounded-lg flex items-center gap-2 text-xs">
            <Check size={14} />
            <span>{success}</span>
          </div>
        )}

        {/* TABS SELECTOR */}
        <div className="flex border-b border-app-border bg-app-header/20 flex-wrap">
          <button
            onClick={() => setActiveTab("members")}
            className={`flex-1 min-w-[70px] py-2.5 text-[10px] font-bold tracking-wider uppercase border-b-2 transition ${
              activeTab === "members" ? "border-brand text-brand" : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            Members
          </button>
          <button
            onClick={() => setActiveTab("rules")}
            className={`flex-1 min-w-[70px] py-2.5 text-[10px] font-bold tracking-wider uppercase border-b-2 transition ${
              activeTab === "rules" ? "border-brand text-brand" : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            Rules
          </button>
          <button
            onClick={() => setActiveTab("media")}
            className={`flex-1 min-w-[70px] py-2.5 text-[10px] font-bold tracking-wider uppercase border-b-2 transition ${
              activeTab === "media" ? "border-brand text-brand" : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            Media
          </button>
        </div>

        {/* TAB CONTENTS */}
        <div className="p-4">
          {/* MEMBERS TAB */}
          {activeTab === "members" && (
            <div className="space-y-4 animate-fade-in">
              {/* ADD MEMBER SECTION */}
              {canAddMembers() && (
                <div className="space-y-3 bg-app-header/20 border border-app-border rounded-xl p-3.5">
                  <h3 className="text-white text-xs font-bold uppercase tracking-wider">Add Members</h3>
                  <input
                    type="text"
                    id="add-member-search-input"
                    placeholder="Search users to add..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-app-input border border-app-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-brand transition"
                  />
                  
                  {/* Selected Users Pill Container */}
                  {selectedUsersToAdd.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-1.5 bg-app-modal/40 rounded-lg max-h-[80px] overflow-y-auto">
                      {selectedUsersToAdd.map((u) => (
                        <div key={u._id} className="flex items-center gap-1 bg-brand/20 border border-brand/40 px-2 py-0.5 rounded-full text-[10px] text-white">
                          <span>@{u.username}</span>
                          <button
                            onClick={() => setSelectedUsersToAdd(prev => prev.filter(x => x._id !== u._id))}
                            className="text-red-400 hover:text-red-300 font-bold shrink-0 ml-0.5"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {searchInviteResults.length > 0 && (
                    <div className="bg-[#202c33]/40 border border-[#222d34] rounded-lg p-1.5 max-h-[160px] overflow-y-auto">
                      {searchInviteResults.map((user) => {
                        const isSelected = selectedUsersToAdd.some(x => x._id === user._id);
                        return (
                          <div 
                            key={user._id} 
                            onClick={() => {
                              if (isSelected) {
                                setSelectedUsersToAdd(prev => prev.filter(x => x._id !== user._id));
                              } else {
                                setSelectedUsersToAdd(prev => [...prev, user]);
                              }
                            }}
                            className={`flex items-center justify-between p-2 hover:bg-app-hover rounded cursor-pointer transition ${
                              isSelected ? "bg-brand/10" : ""
                            }`}
                          >
                            <span className="text-xs text-white">@{user.username}</span>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                              isSelected ? "bg-brand border-brand" : "border-gray-500"
                            }`}>
                              {isSelected && <Check size={10} className="text-white font-bold" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {selectedUsersToAdd.length > 0 && (
                    <button
                      onClick={handleAddSelectedMembers}
                      disabled={loading}
                      className="w-full py-2 bg-brand hover:opacity-95 text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-md mt-1 rounded-lg"
                    >
                      Confirm & Add {selectedUsersToAdd.length} Member(s)
                    </button>
                  )}
                </div>
              )}

              {/* MEMBERS LIST */}
              <div className="space-y-2">
                <h3 className="text-white text-xs font-bold uppercase tracking-wider">Group Members</h3>
                <div className="space-y-1.5">
                  {chat.roles?.filter((r) => r.role !== "left")?.map((memberObj) => {
                    const memberUser = typeof memberObj.user === "object" && memberObj.user !== null && memberObj.user.username
                      ? memberObj.user
                      : chat.participants?.find((p) => {
                          const pId = typeof p === "object" && p !== null ? p._id : p;
                          const mId = typeof memberObj.user === "object" && memberObj.user !== null ? memberObj.user._id : memberObj.user;
                          return pId?.toString() === mId?.toString();
                        });

                    if (!memberUser || !memberUser.username) return null;
                    const isSelf = memberUser._id?.toString() === (currentUser?.id || currentUser?._id)?.toString();
                    const isTargetOwner = memberObj.role === "owner";
                    const isTargetAdmin = memberObj.role === "admin";
                    const canManage = isAdmin && !isSelf;

                    return (
                      <div
                        key={memberUser._id}
                        className="flex items-center justify-between p-2 rounded-lg bg-[#202c33]/20 border border-[#222d34]/40 hover:bg-[#202c33]/40 transition cursor-pointer"
                        onClick={() => {
                          setSelectedMemberAction({ memberUser, memberObj });
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <div 
                            className="relative cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.dispatchEvent(new CustomEvent("view-user-profile", { detail: memberUser }));
                            }}
                          >
                            {memberUser.avatar ? (
                              <img src={memberUser.avatar} alt={memberUser.username} className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-brand/10 dark:bg-brand/25 flex items-center justify-center text-xs font-bold text-brand dark:text-white border border-app-border/40">
                                {memberUser.username[0].toUpperCase()}
                              </div>
                            )}
                            {onlineUsers?.includes(memberUser._id) && (
                              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-brand border border-app-modal rounded-full shadow-md animate-pulse" title="Online" />
                            )}
                          </div>
                          <div>
                            <span className="text-xs text-white font-medium flex items-center gap-1.5">
                              {memberUser.username} {isSelf && <span className="text-[10px] text-gray-400 font-normal">(you)</span>}
                            </span>
                            {memberObj.role === "owner" && (
                              <span className="text-[10px] text-brand bg-brand/10 border border-brand/30 px-1.5 py-0.5 rounded-full font-bold tracking-wide uppercase mt-1 inline-block">Leader</span>
                            )}
                            {memberObj.role === "admin" && (
                              <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-bold tracking-wide uppercase mt-1 inline-block">Admin</span>
                            )}
                          </div>
                        </div>

                        {canManage && (
                          <span className="text-gray-400 hover:text-white px-2.5 py-1 bg-[#111b21]/60 hover:bg-[#111b21] border border-[#222d34] rounded-lg transition text-[10px] font-bold uppercase tracking-wider">
                            Options
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* QUICK ADD PARTICIPANT BUTTON FOR WHATSAPP life cycle */}
              {canAddMembers() && (
                <button
                  onClick={() => {
                    const inputEl = document.getElementById("add-member-search-input");
                    if (inputEl) {
                      inputEl.scrollIntoView({ behavior: "smooth" });
                      inputEl.focus();
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-brand hover:opacity-95 text-white text-xs font-bold tracking-wider uppercase transition mt-4 shadow-md border border-brand/30 hover:shadow-lg hover:scale-[1.01]"
                >
                  <Plus size={15} />
                  <span>Add participant +</span>
                </button>
              )}

              {/* EXIT & LEAVE GROUP BUTTONS */}
              <div className="pt-2 space-y-2">
                {userRole === "left" ? (
                  <button
                    onClick={handleLeaveGroup}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-600/90 hover:bg-red-600 text-white text-xs font-bold tracking-wider uppercase transition shadow-md border border-red-700 hover:shadow-lg hover:scale-[1.01]"
                  >
                    <Trash size={14} />
                    <span>Delete Group Chat</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleLeaveGroup}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-bold tracking-wider uppercase transition shadow-sm"
                    >
                      <LogOut size={14} />
                      <span>Exit Group</span>
                    </button>

                    <button
                      onClick={handleLeaveAndDeleteGroup}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-600/90 hover:bg-red-600 text-white text-xs font-bold tracking-wider uppercase transition shadow-md border border-red-700 hover:shadow-lg hover:scale-[1.01]"
                    >
                      <Trash size={14} />
                      <span>Exit & Delete Group</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* RULES TAB */}
          {activeTab === "rules" && (
            <div className="space-y-4 animate-fade-in">
              {!isOwner && (
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-xs font-medium justify-center select-none shadow-sm">
                  <Lock size={14} className="text-amber-500 shrink-0" />
                  <span>Rules locked by Group Leader</span>
                </div>
              )}

              <div className="bg-[#202c33]/40 border border-[#222d34] rounded-xl p-4 space-y-4">
                {/* Edit Group Info Rule */}
                <div className="space-y-2">
                  <label className="text-white text-xs font-bold uppercase tracking-wider">Who can edit group info?</label>
                  <select
                    disabled={!isOwner}
                    value={editGroupInfoRule}
                    onChange={(e) => setEditGroupInfoRule(e.target.value)}
                    className="w-full bg-app-input border border-app-border disabled:opacity-60 disabled:cursor-not-allowed rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-brand transition"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="admins">Leader and Admins</option>
                    <option value="owner">Leader Only</option>
                  </select>
                </div>

                {/* Edit Profile Photo Rule */}
                <div className="space-y-2">
                  <label className="text-white text-xs font-bold uppercase tracking-wider">Who can change profile photo?</label>
                  <select
                    disabled={!isOwner}
                    value={editProfilePhotoRule}
                    onChange={(e) => setEditProfilePhotoRule(e.target.value)}
                    className="w-full bg-app-input border border-app-border disabled:opacity-60 disabled:cursor-not-allowed rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-brand transition"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="admins">Leader and Admins</option>
                    <option value="owner">Leader Only</option>
                  </select>
                </div>

                {/* Add Members Rule */}
                <div className="space-y-2">
                  <label className="text-white text-xs font-bold uppercase tracking-wider">Who can add members?</label>
                  <select
                    disabled={!isOwner}
                    value={addMembersRule}
                    onChange={(e) => setAddMembersRule(e.target.value)}
                    className="w-full bg-app-input border border-app-border disabled:opacity-60 disabled:cursor-not-allowed rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-brand transition"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="admins">Leader and Admins</option>
                    <option value="owner">Leader Only</option>
                  </select>
                </div>

                {isOwner && (
                  <button
                    onClick={handleSaveRules}
                    disabled={loading}
                    className="w-full bg-brand hover:opacity-95 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-white transition shadow-md flex items-center justify-center gap-1.5 mt-2 hover:scale-[1.01]"
                  >
                    <Check size={14} />
                    <span>Save Rules & Settings</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* MEDIA TAB */}
          {activeTab === "media" && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex border border-[#222d34] rounded-lg overflow-hidden">
                {["images", "videos", "documents"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setMediaTab(tab)}
                    className={`flex-1 py-1.5 text-[10px] uppercase font-bold tracking-wider transition ${
                      mediaTab === tab ? "bg-brand text-white" : "bg-app-header/40 text-gray-400 hover:text-white"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="text-center text-xs text-gray-400 py-10">Fetching Media...</div>
              ) : getFilteredMedia().length === 0 ? (
                <div className="text-center text-xs text-gray-400 py-10 bg-[#202c33]/10 border border-[#222d34]/60 border-dashed rounded-lg">
                  No {mediaTab} shared yet
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {getFilteredMedia().map((msg) => {
                    const files = msg.media?.length ? msg.media : [{ url: msg.mediaUrl, type: msg.messageType }];
                    return files.map((file, i) => {
                      if (mediaTab === "images") {
                        return (
                          <a href={file.url} target="_blank" rel="noreferrer" key={`${msg._id}-${i}`} className="relative group aspect-square rounded-lg overflow-hidden border border-[#222d34] bg-black">
                            <img src={file.url} alt="Media" className="w-full h-full object-cover hover:scale-110 transition duration-300" />
                          </a>
                        );
                      }
                      if (mediaTab === "videos") {
                        return (
                          <a href={file.url} target="_blank" rel="noreferrer" key={`${msg._id}-${i}`} className="relative aspect-square rounded-lg overflow-hidden border border-[#222d34] bg-black flex items-center justify-center">
                            <span className="text-[10px] text-gray-400 font-semibold uppercase">Video</span>
                          </a>
                        );
                      }
                      return (
                        <a href={file.url} target="_blank" rel="noreferrer" key={`${msg._id}-${i}`} className="col-span-3 flex items-center gap-2.5 p-2 bg-[#202c33]/30 border border-[#222d34] rounded-lg hover:bg-[#202c33]/50 transition">
                          <div className="w-8 h-8 rounded bg-[#111b21] flex items-center justify-center text-gray-400">
                            <File size={16} className="text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-white font-medium truncate">{file.fileName || "document.pdf"}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">shared by {msg.sender?.username}</div>
                          </div>
                        </a>
                      );
                    });
                  })}
                </div>
              )}
            </div>
          )}


        </div>
      </div>

      {/* CROP/FILTER IMAGE EDITOR MODAL */}
      <ImageEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        imageSrc={selectedImageSrc}
        onSave={handleSaveGroupCrop}
      />

      {/* WHATSAPP STYLE PREMIUM MEMBER ACTIONS MODAL */}
      {selectedMemberAction && (
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedMemberAction(null)}
        >
          <div 
            className="bg-app-modal border border-app-border rounded-2xl w-full max-w-[280px] p-4 flex flex-col gap-2.5 shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center pb-2.5 border-b border-app-border">
              <div className="w-12 h-12 rounded-full overflow-hidden mb-2 flex items-center justify-center bg-brand/10 dark:bg-brand/25 text-brand dark:text-white border border-app-border/40">
                {selectedMemberAction.memberUser.avatar ? (
                  <img src={selectedMemberAction.memberUser.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-base">{selectedMemberAction.memberUser.username[0].toUpperCase()}</span>
                )}
              </div>
              <span className="text-white text-xs font-bold">@{selectedMemberAction.memberUser.username}</span>
              {selectedMemberAction.memberObj.role !== "member" && (
                <span className={`text-[9px] font-extrabold uppercase tracking-widest mt-1.5 px-2 py-0.5 rounded-full ${
                  selectedMemberAction.memberObj.role === "owner" ? "text-brand bg-brand/10 border border-brand/30" : "text-amber-400 bg-amber-500/10 border border-amber-500/30"
                }`}>
                  {selectedMemberAction.memberObj.role === "owner" ? "Leader" : "Admin"}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5 mt-1 text-center">
              {/* View Profile */}
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("view-user-profile", { detail: selectedMemberAction.memberUser }));
                  setSelectedMemberAction(null);
                }}
                className="w-full py-2 hover:bg-app-hover rounded-lg text-xs font-bold text-app-text-primary transition"
              >
                View Profile
              </button>

              {/* MAKE / DISMISS ADMIN (Leader/Owner or Admin can change roles) */}
              {(userRole === "owner" || userRole === "admin") && selectedMemberAction.memberObj.role === "member" && (
                <button
                  onClick={async () => {
                    await handleRoleChange(selectedMemberAction.memberUser._id, "admin");
                    setSelectedMemberAction(null);
                  }}
                  className="w-full py-2 hover:bg-brand/20 rounded-lg text-xs font-bold text-brand transition"
                >
                  Make Group Admin
                </button>
              )}
              {(userRole === "owner" || userRole === "admin") && selectedMemberAction.memberObj.role === "admin" && (
                <button
                  onClick={async () => {
                    await handleRoleChange(selectedMemberAction.memberUser._id, "member");
                    setSelectedMemberAction(null);
                  }}
                  className="w-full py-2 hover:bg-amber-500/10 rounded-lg text-xs font-bold text-amber-400 transition"
                >
                  Dismiss as Admin
                </button>
              )}

              {/* TRANSFER OWNERSHIP (Leader/Owner only) */}
              {userRole === "owner" && selectedMemberAction.memberObj.role !== "owner" && (
                <button
                  onClick={async () => {
                    if (confirm(`Are you sure you want to transfer group leadership to @${selectedMemberAction.memberUser.username}?`)) {
                      await handleTransferOwnership(selectedMemberAction.memberUser._id);
                      setSelectedMemberAction(null);
                    }
                  }}
                  className="w-full py-2 hover:bg-brand/15 rounded-lg text-xs font-bold text-brand transition border-t border-app-border"
                >
                  Transfer Leadership
                </button>
              )}

              {/* REMOVE USER (Leader can kick anyone, Admins can kick standard members) */}
              {((userRole === "owner") || (userRole === "admin" && selectedMemberAction.memberObj.role === "member")) && (
                <button
                  onClick={async () => {
                    if (confirm(`Are you sure you want to remove @${selectedMemberAction.memberUser.username} from this group?`)) {
                      await handleRemoveMember(selectedMemberAction.memberUser._id);
                      setSelectedMemberAction(null);
                    }
                  }}
                  className="w-full py-2 hover:bg-red-500/15 rounded-lg text-xs font-bold text-red-400 transition border-t border-red-500/10"
                >
                  Remove from Group
                </button>
              )}

              {/* Cancel */}
              <button
                onClick={() => setSelectedMemberAction(null)}
                className="w-full py-2 mt-2 bg-app-hover hover:bg-app-input rounded-lg text-xs font-extrabold text-app-text-primary transition shadow-sm border border-app-border"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GroupDetailsDrawer;
