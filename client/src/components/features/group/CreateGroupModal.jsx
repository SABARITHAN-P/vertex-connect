import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Search, Check, AlertCircle, Camera } from "lucide-react";
import api from "@services/api";
import ImageEditorModal from "@components/features/media/ImageEditorModal";
import { useEscapeKey } from "@hooks/useEscapeKey";

function CreateGroupModal({ onClose, onGroupCreated }) {
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [selectedImageSrc, setSelectedImageSrc] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const fileInputRef = useRef(null);

  // Centralized ESC key support: active only when nested editor is not open
  useEscapeKey(onClose, !isEditorOpen, 10);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/user/search?query=${searchQuery}`);
        setUsers(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchUsers();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleUserSelect = (user) => {
    if (selectedUsers.some((u) => u._id === user._id)) {
      setSelectedUsers(selectedUsers.filter((u) => u._id !== user._id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
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

  const handleSaveCrop = (croppedBlob) => {
    setIsEditorOpen(false);
    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(reader.result);
    };
    reader.readAsDataURL(croppedBlob);
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      setError("Group name is required");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const { data } = await api.post("/chat/group", {
        chatName: groupName,
        groupDescription: description,
        groupAvatar: avatar || "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=150&h=150&q=80",
        participants: selectedUsers.map((u) => u._id),
      });

      onGroupCreated(data);
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to create group");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-app-drawer text-app-text-primary z-50 flex flex-col transition-transform duration-300 transform translate-x-0 select-none animate-slide-in">
      {/* HEADER */}
      <div className="h-[60px] bg-app-header flex items-center p-4 gap-4 border-b border-app-border shrink-0">
        <button
          onClick={onClose}
          className="p-1.5 text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover rounded-full transition cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="text-app-text-primary font-semibold text-lg">Create New Group</span>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* AVATAR SELECT CIRCLE */}
        <div className="flex flex-col items-center justify-center py-1">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-24 h-24 rounded-full bg-app-input border border-app-border/80 flex flex-col items-center justify-center cursor-pointer relative overflow-hidden group hover:border-brand transition-all duration-300 shadow-md"
          >
            {avatar ? (
              <img src={avatar} alt="Avatar Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-2">
                <Camera size={24} className="text-app-text-secondary group-hover:text-app-text-primary transition-colors mb-1" />
                <span className="text-[10px] text-app-text-secondary group-hover:text-app-text-primary font-semibold uppercase tracking-wider">Photo</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200 text-xs text-white uppercase font-bold tracking-wider">
              Upload
            </div>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        {/* GROUP INFO */}
        <div className="space-y-4">
          <div>
            <label className="text-xs text-app-text-secondary uppercase font-bold tracking-wider">Group Name</label>
            <input
              type="text"
              placeholder="Enter group name..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full mt-1.5 bg-app-input border border-app-border focus:border-brand rounded-xl px-4 py-3 text-sm text-app-text-primary outline-none transition-all duration-200"
            />
          </div>

          <div>
            <label className="text-xs text-app-text-secondary uppercase font-bold tracking-wider">Description</label>
            <textarea
              placeholder="What is this group about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full mt-1.5 bg-app-input border border-app-border focus:border-brand rounded-xl px-4 py-2.5 text-sm text-app-text-primary outline-none resize-none transition-all duration-200"
            />
          </div>
        </div>

        <hr className="border-app-border/60" />

        {/* ADD MEMBERS */}
        <div className="space-y-3.5">
          <label className="text-xs text-app-text-secondary uppercase font-bold tracking-wider">
            Add Members ({selectedUsers.length})
          </label>

          {/* SELECTED CHIPS */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto py-1 custom-scrollbar">
              {selectedUsers.map((user) => (
                <span
                  key={user._id}
                  className="inline-flex items-center gap-1.5 bg-brand/10 border border-brand/20 px-3 py-1 rounded-full text-xs text-brand font-semibold animate-fade-in"
                >
                  {user.username}
                  <button
                    onClick={() => toggleUserSelect(user)}
                    className="hover:text-red-500 transition ml-0.5 cursor-pointer text-sm font-bold leading-none"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* SEARCH */}
          <div className="bg-app-input rounded-xl flex items-center px-3.5 border border-app-border focus-within:border-brand/40 transition-colors shadow-sm">
            <Search size={16} className="text-app-text-secondary" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent outline-none px-3 py-2.5 text-sm text-app-text-primary placeholder-app-text-secondary/60"
            />
          </div>

          {/* USERS LIST */}
          <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1">
            {loading ? (
              <div className="text-center text-xs text-app-text-secondary py-4 animate-pulse">Searching...</div>
            ) : users.length === 0 ? (
              <div className="text-center text-xs text-app-text-secondary py-4">No users found</div>
            ) : (
              users.map((user) => {
                const isSelected = selectedUsers.some((u) => u._id === user._id);
                return (
                  <div
                    key={user._id}
                    onClick={() => toggleUserSelect(user)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-200 select-none ${
                      isSelected ? "bg-app-active" : "hover:bg-app-hover/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand/10 dark:bg-brand/20 flex items-center justify-center text-sm font-bold text-brand border border-brand/10">
                        {user.username[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-app-text-primary">{user.username}</div>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-200 ${
                        isSelected ? "bg-brand border-brand scale-105" : "border-app-border bg-transparent"
                      }`}
                    >
                      {isSelected && <Check size={11} className="text-white stroke-[3px]" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="h-[76px] px-6 border-t border-app-border flex items-center justify-between bg-app-header shrink-0">
        <button
          onClick={onClose}
          className="px-4 py-2.5 text-sm font-semibold text-app-text-secondary hover:text-app-text-primary rounded-xl hover:bg-app-hover transition cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={submitting}
          className="bg-brand hover:opacity-95 disabled:opacity-50 text-white px-6 py-2.5 text-sm font-semibold rounded-xl transition shadow-md hover:shadow-brand/20 cursor-pointer"
        >
          {submitting ? "Creating..." : "Create Group"}
        </button>
      </div>

      <ImageEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        imageSrc={selectedImageSrc}
        onSave={handleSaveCrop}
      />
    </div>
  );
}

export default CreateGroupModal;
