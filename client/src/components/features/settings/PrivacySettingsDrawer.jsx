import React, { useState, useEffect } from "react";
import { ArrowLeft, Globe, Lock, Shield, Users, MessageCircle, AlertCircle, Eye, EyeOff, Camera, UserMinus, Mail } from "lucide-react";
import axios from "axios";
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

  useEffect(() => {
    fetchPrivacySettings();
    fetchBlockedUsers();
  }, []);

  const fetchPrivacySettings = async () => {
    try {
      setLoading(true);
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const config = {
        headers: {
          Authorization: `Bearer ${userInfo.token}`,
        },
      };
      const { data } = await axios.get("http://localhost:5000/api/user/privacy", config);
      setSettings(data);
    } catch (error) {
      console.error("Failed to fetch privacy settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBlockedUsers = async () => {
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const config = {
        headers: {
          Authorization: `Bearer ${userInfo.token}`,
        },
      };
      const { data } = await axios.get("http://localhost:5000/api/user/blocked", config);
      setBlockedUsers(data || []);
    } catch (error) {
      console.error("Failed to fetch blocked users:", error);
    }
  };

  const updateSetting = async (field, value) => {
    try {
      setSaving(true);
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const config = {
        headers: {
          Authorization: `Bearer ${userInfo.token}`,
        },
      };
      const updated = { ...settings, [field]: value };
      setSettings(updated);

      await axios.put("http://localhost:5000/api/user/privacy", updated, config);
    } catch (error) {
      console.error("Failed to update privacy settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleUnblock = async (userId) => {
    try {
      setSaving(true);
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const config = {
        headers: {
          Authorization: `Bearer ${userInfo.token}`,
        },
      };
      await axios.post(`http://localhost:5000/api/user/unblock/${userId}`, {}, config);
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-app-drawer text-app-text-primary z-50 flex flex-col transition-transform duration-300 transform translate-x-0 select-none">
      {/* HEADER */}
      <div className="h-[60px] bg-app-header flex items-center p-4 gap-4 border-b border-app-border shrink-0">
        <button
          onClick={onClose}
          className="p-1.5 text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover rounded-full transition"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="text-app-text-primary font-semibold text-lg">Privacy Settings</span>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* ACCOUNT TYPE SECTION */}
        <div className="bg-app-header border border-app-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand/10 rounded-xl">
              <Shield size={20} className="text-brand" />
            </div>
            <div>
              <h3 className="text-app-text-primary font-semibold text-sm">Account Privacy</h3>
              <p className="text-app-text-secondary text-xs mt-0.5">Control how visible your account interactions are.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => updateSetting("accountType", "public")}
              className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition duration-200 ${
                settings.accountType === "public"
                  ? "bg-brand/15 border-brand text-brand font-semibold"
                  : "bg-app-drawer border-app-border text-app-text-secondary hover:bg-app-hover hover:border-app-text-primary"
              }`}
            >
              <Globe size={22} />
              <span className="text-xs font-semibold">Public Account</span>
            </button>

            <button
              onClick={() => updateSetting("accountType", "private")}
              className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition duration-200 ${
                settings.accountType === "private"
                  ? "bg-brand/15 border-brand text-brand font-semibold"
                  : "bg-app-drawer border-app-border text-app-text-secondary hover:bg-app-hover hover:border-app-text-primary"
              }`}
            >
              <Lock size={22} />
              <span className="text-xs font-semibold">Private Account</span>
            </button>
          </div>

          <div className="flex items-start gap-2 bg-app-hover p-3.5 rounded-xl border border-app-border">
            <AlertCircle size={16} className="text-app-text-secondary shrink-0 mt-0.5" />
            <p className="text-[11px] text-app-text-secondary leading-normal">
              {settings.accountType === "private"
                ? "🔒 Private Account: Only users who mutually follow you can start new chat sessions or send messages."
                : "🌐 Public Account: Anyone can send you initial messages, but you can only reply if you follow them back."}
            </p>
          </div>
        </div>

        {/* LAST SEEN & ONLINE STATUS VISIBILITY */}
        <div className="bg-app-header border border-app-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand/10 rounded-xl">
              <Eye size={20} className="text-brand" />
            </div>
            <div>
              <h3 className="text-app-text-primary font-semibold text-sm">Last Seen & Online</h3>
              <p className="text-app-text-secondary text-xs mt-0.5">Manage who can see when you were last active.</p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-app-text-primary text-xs font-semibold">Show Last Seen</h4>
                <p className="text-app-text-secondary text-[11px] mt-0.5">Let others see the exact time you logged off.</p>
              </div>
              <button
                onClick={() => updateSetting("showLastSeen", !settings.showLastSeen)}
                className={`w-12 h-6 rounded-full p-1 transition-all duration-200 ease-in-out ${
                  settings.showLastSeen ? "bg-brand flex justify-end" : "bg-app-drawer border border-app-border flex justify-start"
                }`}
              >
                <div className={`w-4 h-4 rounded-full transition-transform ${settings.showLastSeen ? "bg-white" : "bg-app-text-secondary"}`} />
              </button>
            </div>

            <div className="h-[1px] bg-app-border" />

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-app-text-primary text-xs font-semibold">Show Online Status</h4>
                <p className="text-app-text-secondary text-[11px] mt-0.5">Show a green indicator when you are actively using the app.</p>
              </div>
              <button
                onClick={() => updateSetting("showOnline", !settings.showOnline)}
                className={`w-12 h-6 rounded-full p-1 transition-all duration-200 ease-in-out ${
                  settings.showOnline ? "bg-brand flex justify-end" : "bg-app-drawer border border-app-border flex justify-start"
                }`}
              >
                <div className={`w-4 h-4 rounded-full transition-transform ${settings.showOnline ? "bg-white" : "bg-app-text-secondary"}`} />
              </button>
            </div>
          </div>
        </div>

        {/* PROFILE PHOTO VISIBILITY */}
        <div className="bg-app-header border border-app-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand/10 rounded-xl">
              <Camera size={20} className="text-brand" />
            </div>
            <div>
              <h3 className="text-app-text-primary font-semibold text-sm">Profile Photo Visibility</h3>
              <p className="text-app-text-secondary text-xs mt-0.5">Choose who can view your profile picture.</p>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {[
              { id: "everyone", label: "Everyone" },
              { id: "followers", label: "Followers Only" },
              { id: "mutual", label: "Mutual Followers Only" },
              { id: "nobody", label: "Nobody" },
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => updateSetting("profilePhotoPermission", option.id)}
                className={`w-full p-3.5 rounded-xl border flex items-center justify-between transition ${
                  settings.profilePhotoPermission === option.id
                    ? "bg-brand/15 border-brand text-brand font-semibold"
                    : "bg-app-drawer border-app-border text-app-text-secondary hover:bg-app-hover hover:border-app-text-primary"
                }`}
              >
                <span className="text-xs font-medium">{option.label}</span>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                    settings.profilePhotoPermission === option.id
                      ? "border-brand bg-brand"
                      : "border-app-border"
                  }`}
                >
                  {settings.profilePhotoPermission === option.id && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* EMAIL VISIBILITY */}
        <div className="bg-app-header border border-app-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand/10 rounded-xl">
              <Mail size={20} className="text-brand" />
            </div>
            <div>
              <h3 className="text-app-text-primary font-semibold text-sm">Email Visibility</h3>
              <p className="text-app-text-secondary text-xs mt-0.5">Choose who can view your email address.</p>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {[
              { id: "everyone", label: "Everyone" },
              { id: "followers", label: "Followers Only" },
              { id: "mutual", label: "Mutual Followers Only" },
              { id: "nobody", label: "Nobody" },
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => updateSetting("emailVisibility", option.id)}
                className={`w-full p-3.5 rounded-xl border flex items-center justify-between transition ${
                  settings.emailVisibility === option.id
                    ? "bg-brand/15 border-brand text-brand font-semibold"
                    : "bg-app-drawer border-app-border text-app-text-secondary hover:bg-app-hover hover:border-app-text-primary"
                }`}
              >
                <span className="text-xs font-medium">{option.label}</span>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                    settings.emailVisibility === option.id
                      ? "border-brand bg-brand"
                      : "border-app-border"
                  }`}
                >
                  {settings.emailVisibility === option.id && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* MESSAGES PERMISSION */}
        <div className="bg-app-header border border-app-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand/10 rounded-xl">
              <MessageCircle size={20} className="text-brand" />
            </div>
            <div>
              <h3 className="text-app-text-primary font-semibold text-sm">Direct Messages</h3>
              <p className="text-app-text-secondary text-xs mt-0.5">Who can start a conversation with you.</p>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {[
              { id: "everyone", label: "Everyone" },
              { id: "followers", label: "Followers Only" },
              { id: "mutual", label: "Mutual Followers Only" },
              { id: "nobody", label: "Nobody" },
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => updateSetting("messagesPermission", option.id)}
                className={`w-full p-3.5 rounded-xl border flex items-center justify-between transition ${
                  settings.messagesPermission === option.id
                    ? "bg-brand/15 border-brand text-brand font-semibold"
                    : "bg-app-drawer border-app-border text-app-text-secondary hover:bg-app-hover hover:border-app-text-primary"
                }`}
              >
                <span className="text-xs font-medium">{option.label}</span>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                    settings.messagesPermission === option.id
                      ? "border-brand bg-brand"
                      : "border-app-border"
                  }`}
                >
                  {settings.messagesPermission === option.id && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* GROUPS PERMISSION */}
        <div className="bg-app-header border border-app-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand/10 rounded-xl">
              <Users size={20} className="text-brand" />
            </div>
            <div>
              <h3 className="text-app-text-primary font-semibold text-sm">Group Additions</h3>
              <p className="text-app-text-secondary text-xs mt-0.5">Who can add you to group chats.</p>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {[
              { id: "everyone", label: "Everyone" },
              { id: "followers", label: "Followers Only" },
              { id: "mutual", label: "Mutual Followers Only" },
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => updateSetting("groupsPermission", option.id)}
                className={`w-full p-3.5 rounded-xl border flex items-center justify-between transition ${
                  settings.groupsPermission === option.id
                    ? "bg-brand/15 border-brand text-brand font-semibold"
                    : "bg-app-drawer border-app-border text-app-text-secondary hover:bg-app-hover hover:border-app-text-primary"
                }`}
              >
                <span className="text-xs font-medium">{option.label}</span>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                    settings.groupsPermission === option.id
                      ? "border-brand bg-brand"
                      : "border-app-border"
                  }`}
                >
                  {settings.groupsPermission === option.id && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* BLOCKED CONTACTS SECTION */}
        <div className="bg-app-header border border-app-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-500/10 rounded-xl">
              <UserMinus size={20} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-app-text-primary font-semibold text-sm">Blocked Contacts</h3>
              <p className="text-app-text-secondary text-xs mt-0.5">Users you have blocked from messaging you.</p>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {blockedUsers.length === 0 ? (
              <p className="text-xs text-app-text-secondary italic text-center py-4 bg-app-drawer border border-app-border rounded-xl">
                No blocked contacts.
              </p>
            ) : (
              blockedUsers.map((user) => (
                <div
                  key={user._id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-app-border bg-app-drawer"
                >
                  <div className="flex items-center gap-3">
                    {user.avatar ? (
                      <img src={user.avatar} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-app-border" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-brand/10 dark:bg-brand/25 flex items-center justify-center text-xs font-bold text-brand dark:text-white border border-app-border/40">
                        {user.username[0].toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs font-semibold text-app-text-primary">{user.username}</span>
                  </div>
                  <button
                    onClick={() => handleUnblock(user._id)}
                    className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[10px] font-bold shadow-sm transition"
                  >
                    Unblock
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {saving && (
          <div className="text-center text-xs text-brand animate-pulse font-medium">
            Saving settings in real-time...
          </div>
        )}

      </div>
    </div>
  );
}

export default PrivacySettingsDrawer;
