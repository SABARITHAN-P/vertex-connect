import { useState, useEffect, useRef } from "react";
import { X, Search, Check, AlertCircle, Camera } from "lucide-react";
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-app-modal text-app-text-primary w-full max-w-md rounded-2xl border border-app-border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-fade-in">
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-app-border flex justify-between items-center bg-app-header">
          <h2 className="text-lg font-semibold tracking-wide">Create New Group</h2>
          <button onClick={onClose} className="text-app-text-secondary hover:text-app-text-primary transition cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* GROUP INFO */}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-app-text-secondary uppercase font-bold tracking-wider">Group Name</label>
              <input
                type="text"
                placeholder="Enter group name..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full mt-1 bg-app-input border border-app-border focus:border-brand rounded-lg px-3.5 py-2.5 text-sm text-app-text-primary outline-none transition"
              />
            </div>

            <div>
              <label className="text-xs text-app-text-secondary uppercase font-bold tracking-wider">Description</label>
              <textarea
                placeholder="What is this group about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full mt-1 bg-app-input border border-app-border focus:border-brand rounded-lg px-3.5 py-2 text-sm text-app-text-primary outline-none resize-none transition"
              />
            </div>

            {/* AVATAR SELECT CIRCLE */}
            <div className="flex flex-col items-center justify-center py-2">
              <label className="text-xs text-app-text-secondary uppercase font-bold tracking-wider mb-2">Group Profile Photo</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-full bg-app-input border border-app-border flex flex-col items-center justify-center cursor-pointer relative overflow-hidden group hover:border-brand transition shadow-md"
              >
                {avatar ? (
                  <img src={avatar} alt="Avatar Preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera size={24} className="text-app-text-secondary group-hover:text-app-text-primary transition" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-[8px] text-white uppercase font-bold tracking-wider">
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
          </div>

          <hr className="border-app-border" />

          {/* ADD MEMBERS */}
          <div className="space-y-3">
            <label className="text-xs text-app-text-secondary uppercase font-bold tracking-wider">
              Add Members ({selectedUsers.length})
            </label>

            {/* SELECTED CHIPS */}
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-h-[75px] overflow-y-auto py-1">
                {selectedUsers.map((user) => (
                  <span
                    key={user._id}
                    className="inline-flex items-center gap-1 bg-brand/20 border border-brand/30 px-2.5 py-1 rounded-full text-xs text-brand font-medium"
                  >
                    {user.username}
                    <button
                      onClick={() => toggleUserSelect(user)}
                      className="hover:text-red-400 transition ml-0.5 cursor-pointer"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* SEARCH */}
            <div className="bg-app-input rounded-lg flex items-center px-3 border border-app-border">
              <Search size={16} className="text-app-text-secondary" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent outline-none px-3 py-2 text-sm text-app-text-primary placeholder-app-text-secondary"
              />
            </div>

            {/* USERS LIST */}
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
              {loading ? (
                <div className="text-center text-xs text-app-text-secondary py-4">Searching...</div>
              ) : users.length === 0 ? (
                <div className="text-center text-xs text-app-text-secondary py-4">No users found</div>
              ) : (
                users.map((user) => {
                  const isSelected = selectedUsers.some((u) => u._id === user._id);
                  return (
                    <div
                      key={user._id}
                      onClick={() => toggleUserSelect(user)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${
                        isSelected ? "bg-app-active border border-brand/40" : "hover:bg-app-hover border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand/10 dark:bg-brand/25 flex items-center justify-center text-xs font-bold text-brand dark:text-white border border-app-border/40">
                          {user.username[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-app-text-primary">{user.username}</div>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                          isSelected ? "bg-brand border-brand" : "border-app-border"
                        }`}
                      >
                        {isSelected && <Check size={12} className="text-white" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-5 py-4 border-t border-app-border flex justify-end gap-3 bg-app-header">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-app-text-secondary hover:text-app-text-primary transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={submitting}
            className="bg-brand hover:opacity-90 disabled:opacity-50 text-white px-5 py-2 text-sm font-semibold rounded-lg transition shadow-md cursor-pointer"
          >
            {submitting ? "Creating..." : "Create Group"}
          </button>
        </div>
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
