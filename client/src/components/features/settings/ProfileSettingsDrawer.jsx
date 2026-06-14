import { useState, useRef } from "react";
import api from "@services/api";
import { ArrowLeft, Camera, Edit2, Check, X, User, Info } from "lucide-react";
import ImageEditorModal from "@components/features/media/ImageEditorModal";
import { useEscapeKey } from "@hooks/useEscapeKey";
import { premiumAlert, premiumConfirm } from "@utils/alert";

function ProfileSettingsDrawer({ onClose, currentUser, setCurrentUser }) {
  const [username, setUsername] = useState(currentUser.username || "");
  const [avatar, setAvatar] = useState(currentUser.avatar || "");
  const [status, setStatus] = useState(currentUser.about || currentUser.status || "Hey there! I am using Vertex Connect.");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedImageSrc, setSelectedImageSrc] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const fileInputRef = useRef(null);

  // Centralized ESC key support: close sidebar on Escape. Priority: 5 (lower than modals)
  useEscapeKey(onClose, !isEditorOpen, 5);

  // Fallback default avatar initials
  const getInitials = (name) => {
    return name ? name.charAt(0).toUpperCase() : "?";
  };

  // Profile Picture Upload Trigger
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      premiumAlert("Invalid File", "Please upload a valid image file.", "error");
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

  // Profile Picture Upload
  const handleSaveCrop = async (croppedBlob) => {
    setIsEditorOpen(false);
    setLoading(true);
    setUploadProgress(20);

    const formData = new FormData();
    formData.append("avatar", croppedBlob, "avatar.jpg");

    try {
      setUploadProgress(50);
      const { data } = await api.put("/user/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadProgress(90);
      setAvatar(data.avatar);
      
      const updatedUser = { ...currentUser, avatar: data.avatar };
      localStorage.setItem("userInfo", JSON.stringify(updatedUser));
      setCurrentUser?.(updatedUser);
      
      setUploadProgress(100);
    } catch (error) {
      console.error(error);
      premiumAlert("Upload Failed", "Failed to upload profile picture.", "error");
    } finally {
      setTimeout(() => {
        setLoading(false);
        setUploadProgress(0);
      }, 500);
    }
  };

  // Remove Profile Picture
  const handleRemoveAvatar = async () => {
    const confirmed = await premiumConfirm(
      "Remove Profile Picture",
      "Are you sure you want to remove your profile picture?",
      "question"
    );
    if (!confirmed) return;
    setLoading(true);
    try {
      await api.delete("/user/avatar");
      setAvatar("");
      const updatedUser = { ...currentUser, avatar: "" };
      localStorage.setItem("userInfo", JSON.stringify(updatedUser));
      setCurrentUser?.(updatedUser);
    } catch (error) {
      console.error(error);
      premiumAlert("Error", "Failed to remove profile picture.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Update Username and Status Info
  const handleSaveUsername = async () => {
    if (!username.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.put("/user/profile", {
        username: username.trim(),
        status: status.trim()
      });
      setUsername(data.username);
      setStatus(data.about || data.status);
      const updatedUser = { 
        ...currentUser, 
        username: data.username, 
        status: data.status,
        about: data.about || data.status
      };
      localStorage.setItem("userInfo", JSON.stringify(updatedUser));
      setCurrentUser?.(updatedUser);
      setIsEditingName(false);
    } catch (error) {
      console.error(error);
      const errMsg = error.response?.data?.message || "Failed to update username.";
      premiumAlert("Error", errMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStatus = async () => {
    setLoading(true);
    try {
      const { data } = await api.put("/user/profile", {
        username: username.trim(),
        status: status.trim()
      });
      setUsername(data.username);
      setStatus(data.about || data.status);
      const updatedUser = { 
        ...currentUser, 
        username: data.username, 
        status: data.status,
        about: data.about || data.status
      };
      localStorage.setItem("userInfo", JSON.stringify(updatedUser));
      setCurrentUser?.(updatedUser);
      setIsEditingStatus(false);
    } catch (error) {
      console.error(error);
      premiumAlert("Error", "Failed to update status.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-app-drawer text-app-text-primary z-50 flex flex-col transition-transform duration-300 transform translate-x-0 select-none animate-slide-in">
      {/* HEADER */}
      <div className="h-[60px] bg-app-header border-b border-app-border flex items-center p-4 gap-4 shrink-0">
        <button
          onClick={onClose}
          className="p-1.5 text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover rounded-full transition cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="text-app-text-primary font-semibold text-lg animate-fade-in">Profile</span>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center gap-6 pb-12">
        
        {/* AVATAR SYSTEM */}
        <div className="relative group w-32 h-32 rounded-full overflow-hidden flex items-center justify-center cursor-pointer bg-brand border-2 border-app-border/80 hover:border-brand transition-all shadow-md shrink-0">
          {avatar ? (
            <img
              src={avatar}
              alt="Profile"
              className="w-full h-full object-cover group-hover:opacity-40 transition-opacity"
            />
          ) : (
            <span className="text-white text-4xl font-bold group-hover:opacity-40 transition-opacity">
              {getInitials(username)}
            </span>
          )}

          {/* UPLOAD/REMOVE HOVER OVERLAY */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity gap-1 text-center px-2"
          >
            <Camera size={22} className="text-white" />
            <span className="text-[9px] text-white uppercase font-bold tracking-wider">
              Change Photo
            </span>
          </div>

          {/* LOADING COVER */}
          {loading && (
            <div className="absolute inset-0 bg-app-header/80 flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
              {uploadProgress > 0 && (
                <span className="text-[10px] text-white font-bold">{uploadProgress}%</span>
              )}
            </div>
          )}
        </div>

        {/* PROFILE PICTURE OPTIONS */}
        {avatar && !loading && (
          <button
            onClick={handleRemoveAvatar}
            className="text-red-400 hover:text-red-300 text-[10px] font-bold uppercase tracking-wider bg-red-500/10 hover:bg-red-500/20 px-3.5 py-1.5 rounded-full transition cursor-pointer"
          >
            Remove Photo
          </button>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />

        {/* PROFILE USERNAME */}
        <div className="w-full bg-app-header/40 rounded-2xl p-4.5 border border-app-border/80 space-y-1.5">
          <div className="flex items-center gap-1.5 text-brand">
            <User size={13} />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Your Name
            </span>
          </div>

          <div className="flex items-center justify-between">
            {isEditingName ? (
              <div className="flex items-center w-full gap-2 border-b border-brand pb-1 mt-1">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={25}
                  className="bg-transparent text-app-text-primary font-semibold outline-none w-full text-sm py-0.5"
                  autoFocus
                />
                <button
                  onClick={handleSaveUsername}
                  className="text-app-text-secondary hover:text-app-text-primary transition cursor-pointer"
                >
                  <Check size={18} className="text-brand" />
                </button>
                <button
                  onClick={() => {
                    setUsername(currentUser.username);
                    setIsEditingName(false);
                  }}
                  className="text-app-text-secondary hover:text-app-text-primary transition cursor-pointer"
                >
                  <X size={18} className="text-red-400" />
                </button>
              </div>
            ) : (
              <>
                <span className="text-app-text-primary font-semibold text-sm mt-1">{username}</span>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="text-app-text-secondary hover:text-app-text-primary p-1 hover:bg-app-hover rounded-full transition cursor-pointer"
                >
                  <Edit2 size={13} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* PROFILE ABOUT / BIO STATUS */}
        <div className="w-full bg-app-header/40 rounded-2xl p-4.5 border border-app-border/80 space-y-1.5">
          <div className="flex items-center gap-1.5 text-brand">
            <Info size={13} />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              About
            </span>
          </div>

          <div className="flex items-center justify-between">
            {isEditingStatus ? (
              <div className="flex items-center w-full gap-2 border-b border-brand pb-1 mt-1">
                <input
                  type="text"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  maxLength={100}
                  className="bg-transparent text-app-text-primary font-semibold outline-none w-full text-sm py-0.5"
                  autoFocus
                />
                <button
                  onClick={handleSaveStatus}
                  className="text-app-text-secondary hover:text-app-text-primary transition cursor-pointer"
                >
                  <Check size={18} className="text-brand" />
                </button>
                <button
                  onClick={() => {
                    setStatus(currentUser.status || "Hey there! I am using Vertex Connect.");
                    setIsEditingStatus(false);
                  }}
                  className="text-app-text-secondary hover:text-app-text-primary transition cursor-pointer"
                >
                  <X size={18} className="text-red-400" />
                </button>
              </div>
            ) : (
              <>
                <span className="text-app-text-primary font-medium text-xs leading-relaxed break-words max-w-[85%] mt-1">{status}</span>
                <button
                  onClick={() => setIsEditingStatus(true)}
                  className="text-app-text-secondary hover:text-app-text-primary p-1 hover:bg-app-hover rounded-full transition cursor-pointer"
                >
                  <Edit2 size={13} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* INFO FOOTER */}
        <div className="text-[10px] text-app-text-secondary text-center px-4 leading-relaxed mt-auto max-w-[280px]">
          This is not your pin. This name and status bio will be visible to your mutual followers in Vertex Connect.
        </div>

      </div>
      {isEditorOpen && (
        <ImageEditorModal
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          imageSrc={selectedImageSrc}
          onSave={handleSaveCrop}
        />
      )}
    </div>
  );
}

export default ProfileSettingsDrawer;
