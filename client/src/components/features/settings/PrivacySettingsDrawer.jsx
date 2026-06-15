/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { ArrowLeft, Globe, Lock, Shield, Users, MessageCircle, Eye, Camera, UserMinus, Mail } from "lucide-react";
import api from "@services/api";
import { useEscapeKey } from "@hooks/useEscapeKey";

function PrivacySettingsDrawer({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [settings, setSettings] = useState({
    accountType: "public",
    messagesPermission: "everyone",
    groupsPermission: "everyone",
    showLastSeen: true,
    showOnline: true,
    profilePhotoPermission: "everyone",
    emailVisibility: "everyone",
  });

  // Centralized ESC key support: close privacy settings drawer on Escape. Priority: 6
  useEscapeKey(onClose, true, 6);



  const fetchPrivacySettings = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/user/privacy");
      setSettings(data);
    } catch (error) {
      console.error("Failed to fetch privacy settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBlockedUsers = async () => {
    try {
      const { data } = await api.get("/user/blocked");
      setBlockedUsers(data || []);
    } catch (error) {
      console.error("Failed to fetch blocked users:", error);
    }
  };

  useEffect(() => {
    fetchPrivacySettings();
    fetchBlockedUsers();
  }, []);

  const updateSetting = async (field, value) => {
    try {
      setSaving(true);
      const updated = { ...settings, [field]: value };
      setSettings(updated);
      await api.put("/user/privacy", updated);
    } catch (error) {
      console.error("Failed to update privacy settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleUnblock = async (userId) => {
    try {
      setSaving(true);
      await api.post(`/user/unblock/${userId}`);
      await fetchBlockedUsers();
    } catch (error) {
      console.error("Failed to unblock user:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="absolute inset-0 bg-app-drawer text-app-text-primary z-50 flex flex-col justify-center items-center">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-brand border-t-transparent"></div>
      </div>
    );
  }

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
        <span className="text-app-text-primary font-semibold text-lg animate-fade-in">Privacy Settings</span>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-12">
        
        {/* ACCOUNT TYPE SECTION */}
        <div className="bg-app-header/40 border border-app-border/80 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 text-brand bg-brand/10 rounded-xl">
              <Shield size={18} />
            </div>
            <div>
              <h3 className="text-app-text-primary font-bold text-xs uppercase tracking-wider">Account Privacy</h3>
              <p className="text-app-text-secondary text-[10px] mt-0.5">Control how visible your account interactions are.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => updateSetting("accountType", "public")}
              className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition duration-200 cursor-pointer ${
                settings.accountType === "public"
                  ? "bg-brand/15 border-brand text-brand font-semibold shadow-inner"
                  : "bg-app-drawer/55 border-app-border/70 text-app-text-secondary hover:bg-app-hover hover:border-app-text-primary"
              }`}
            >
              <Globe size={18} />
              <span className="text-xs font-semibold">Public Account</span>
            </button>

            <button
              onClick={() => updateSetting("accountType", "private")}
              className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition duration-200 cursor-pointer ${
                settings.accountType === "private"
                  ? "bg-brand/15 border-brand text-brand font-semibold shadow-inner"
                  : "bg-app-drawer/55 border-app-border/70 text-app-text-secondary hover:bg-app-hover hover:border-app-text-primary"
              }`}
            >
              <Lock size={18} />
              <span className="text-xs font-semibold">Private Account</span>
            </button>
          </div>
        </div>

        {/* LAST SEEN & ONLINE STATUS VISIBILITY */}
        <div className="bg-app-header/40 border border-app-border/80 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 text-brand bg-brand/10 rounded-xl">
              <Eye size={18} />
            </div>
            <div>
              <h3 className="text-app-text-primary font-bold text-xs uppercase tracking-wider">Last Seen & Online</h3>
              <p className="text-app-text-secondary text-[10px] mt-0.5">Manage who can see when you were last active.</p>
            </div>
          </div>

          <div className="space-y-4 pt-2 divide-y divide-app-border/40">
            <div className="flex items-center justify-between py-1">
              <div>
                <h4 className="text-app-text-primary text-xs font-semibold">Show Last Seen</h4>
                <p className="text-app-text-secondary text-[10px] mt-0.5">Let others see the exact time you logged off.</p>
              </div>
              <button
                onClick={() => updateSetting("showLastSeen", !settings.showLastSeen)}
                className={`w-10 h-5 rounded-full relative transition-colors duration-200 ease-in-out shrink-0 cursor-pointer focus:outline-none ${
                  settings.showLastSeen ? "bg-brand" : "bg-app-border"
                }`}
              >
                <span
                  className={`block w-3 h-3 rounded-full bg-white absolute top-1 left-1 transition-transform duration-200 ease-in-out ${
                    settings.showLastSeen ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-3.5">
              <div>
                <h4 className="text-app-text-primary text-xs font-semibold">Show Online Status</h4>
                <p className="text-app-text-secondary text-[10px] mt-0.5">Show a green indicator when you are actively using the app.</p>
              </div>
              <button
                onClick={() => updateSetting("showOnline", !settings.showOnline)}
                className={`w-10 h-5 rounded-full relative transition-colors duration-200 ease-in-out shrink-0 cursor-pointer focus:outline-none ${
                  settings.showOnline ? "bg-brand" : "bg-app-border"
                }`}
              >
                <span
                  className={`block w-3 h-3 rounded-full bg-white absolute top-1 left-1 transition-transform duration-200 ease-in-out ${
                    settings.showOnline ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* PROFILE PHOTO VISIBILITY */}
        <div className="bg-app-header/40 border border-app-border/80 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 text-brand bg-brand/10 rounded-xl">
              <Camera size={18} />
            </div>
            <div>
              <h3 className="text-app-text-primary font-bold text-xs uppercase tracking-wider">Profile Photo Visibility</h3>
              <p className="text-app-text-secondary text-[10px] mt-0.5">Choose who can view your profile picture.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            {[
              { id: "everyone", label: "Everyone" },
              { id: "followers", label: "Followers Only" },
              { id: "mutual", label: "Mutual Followers Only" },
              { id: "nobody", label: "Nobody" },
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => updateSetting("profilePhotoPermission", option.id)}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-1 transition cursor-pointer ${
                  settings.profilePhotoPermission === option.id
                    ? "bg-brand/15 border-brand text-brand font-semibold shadow-inner"
                    : "bg-app-drawer/55 border-app-border/70 text-app-text-secondary hover:bg-app-hover hover:border-app-text-primary"
                }`}
              >
                <span className="text-xs font-bold">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* EMAIL VISIBILITY */}
        <div className="bg-app-header/40 border border-app-border/80 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 text-brand bg-brand/10 rounded-xl">
              <Mail size={18} />
            </div>
            <div>
              <h3 className="text-app-text-primary font-bold text-xs uppercase tracking-wider">Email Visibility</h3>
              <p className="text-app-text-secondary text-[10px] mt-0.5">Choose who can view your email address.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            {[
              { id: "everyone", label: "Everyone" },
              { id: "followers", label: "Followers Only" },
              { id: "mutual", label: "Mutual Followers Only" },
              { id: "nobody", label: "Nobody" },
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => updateSetting("emailVisibility", option.id)}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-1 transition cursor-pointer ${
                  settings.emailVisibility === option.id
                    ? "bg-brand/15 border-brand text-brand font-semibold shadow-inner"
                    : "bg-app-drawer/55 border-app-border/70 text-app-text-secondary hover:bg-app-hover hover:border-app-text-primary"
                }`}
              >
                <span className="text-xs font-bold">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* MESSAGES PERMISSION */}
        <div className="bg-app-header/40 border border-app-border/80 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 text-brand bg-brand/10 rounded-xl">
              <MessageCircle size={18} />
            </div>
            <div>
              <h3 className="text-app-text-primary font-bold text-xs uppercase tracking-wider">Direct Messages</h3>
              <p className="text-app-text-secondary text-[10px] mt-0.5">Who can start a conversation with you.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            {[
              { id: "everyone", label: "Everyone" },
              { id: "followers", label: "Followers Only" },
              { id: "mutual", label: "Mutual Followers Only" },
              { id: "nobody", label: "Nobody" },
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => updateSetting("messagesPermission", option.id)}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-1 transition cursor-pointer ${
                  settings.messagesPermission === option.id
                    ? "bg-brand/15 border-brand text-brand font-semibold shadow-inner"
                    : "bg-app-drawer/55 border-app-border/70 text-app-text-secondary hover:bg-app-hover hover:border-app-text-primary"
                }`}
              >
                <span className="text-xs font-bold">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* GROUPS PERMISSION */}
        <div className="bg-app-header/40 border border-app-border/80 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 text-brand bg-brand/10 rounded-xl">
              <Users size={18} />
            </div>
            <div>
              <h3 className="text-app-text-primary font-bold text-xs uppercase tracking-wider">Who Can Add You to Groups</h3>
              <p className="text-app-text-secondary text-[10px] mt-0.5">Control who can add you to group chats.</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2">
            {[
              { id: "everyone", label: "Everyone" },
              { id: "followers", label: "Only Followers" },
              { id: "mutual", label: "Mutual Followers" },
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => updateSetting("groupsPermission", option.id)}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-1 transition cursor-pointer ${
                  settings.groupsPermission === option.id
                    ? "bg-brand/15 border-brand text-brand font-semibold shadow-inner"
                    : "bg-app-drawer/55 border-app-border/70 text-app-text-secondary hover:bg-app-hover hover:border-app-text-primary"
                }`}
              >
                <span className="text-xs font-bold">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* BLOCKED CONTACTS SECTION */}
        <div className="bg-app-header/40 border border-app-border/80 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 text-red-500 bg-red-500/10 rounded-xl">
              <UserMinus size={18} />
            </div>
            <div>
              <h3 className="text-red-500 font-bold text-xs uppercase tracking-wider">Blocked Contacts</h3>
              <p className="text-app-text-secondary text-[10px] mt-0.5">Users you have blocked from messaging you.</p>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {blockedUsers.length === 0 ? (
              <p className="text-xs text-app-text-secondary italic text-center py-5 bg-app-drawer/50 border border-dashed border-app-border/60 rounded-xl">
                No blocked contacts.
              </p>
            ) : (
              blockedUsers.map((user) => (
                <div
                  key={user._id}
                  className="flex items-center justify-between p-3 rounded-xl border border-app-border/70 bg-app-drawer/45"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {user.avatar ? (
                      <img src={user.avatar} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-app-border" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-brand/15 flex items-center justify-center text-xs font-bold text-brand border border-brand/20 shrink-0">
                        {user.username[0].toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs font-semibold text-app-text-primary truncate">{user.username}</span>
                  </div>
                  <button
                    onClick={() => handleUnblock(user._id)}
                    className="px-3.5 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[9px] font-bold shadow-sm transition shrink-0 cursor-pointer"
                  >
                    Unblock
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {saving && (
          <div className="text-center text-[10px] text-brand animate-pulse font-bold tracking-wider uppercase">
            Saving settings in real-time...
          </div>
        )}

      </div>
    </div>
  );
}

export default PrivacySettingsDrawer;
