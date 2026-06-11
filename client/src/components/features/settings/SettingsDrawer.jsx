import React, { useState, useEffect } from "react";
import PrivacySettingsDrawer from "@components/features/settings/PrivacySettingsDrawer";
import FollowRequestsDrawer from "@components/features/social/FollowRequestsDrawer";
import ThemeBackgroundDrawer from "@components/features/settings/ThemeBackgroundDrawer";
import GeneralSettingsDrawer from "@components/features/settings/GeneralSettingsDrawer";
import HelpFeedbackDrawer from "@components/features/settings/HelpFeedbackDrawer";
import FollowersFollowingDrawer from "@components/features/social/FollowersFollowingDrawer";
import api from "@services/api";
import { 
  ArrowLeft, 
  Search, 
  Monitor, 
  User, 
  KeyRound, 
  Lock, 
  MessageSquare, 
  Video, 
  Bell, 
  Keyboard, 
  HelpCircle, 
  LogOut,
  Users
} from "lucide-react";
import { useEscapeKey } from "@hooks/useEscapeKey";

function SettingsDrawer({ onClose, currentUser, onOpenProfile, onOpenChat }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [showFollowRequests, setShowFollowRequests] = useState(false);
  const [showThemeBackground, setShowThemeBackground] = useState(false);
  const [showGeneralSettings, setShowGeneralSettings] = useState(false);
  const [showHelpFeedback, setShowHelpFeedback] = useState(false);
  const [showFollowersFollowing, setShowFollowersFollowing] = useState(false);
  const [requestCount, setRequestCount] = useState(0);

  // Centralized ESC key support: close settings drawer on Escape. Priority: 5
  useEscapeKey(onClose, true, 5);

  useEffect(() => {
    fetchRequestCount();
  }, []);

  const fetchRequestCount = async () => {
    try {
      const { data } = await api.get("/user/follow/requests");
      setRequestCount(data.length);
    } catch (error) {
      console.error("Failed to fetch follow requests count:", error);
    }
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to log out of Vertex Connect?")) {
      localStorage.removeItem("userInfo");
      window.location.reload();
    }
  };

  const getInitials = (name) => {
    return name ? name.charAt(0).toUpperCase() : "?";
  };

  // List of settings cards
  const settingsItems = [
    {
      id: "general",
      title: "General",
      desc: "Manage font size, font style, and compact mode",
      icon: Monitor,
      action: () => setShowGeneralSettings(true),
    },
    {
      id: "profile",
      title: "Profile",
      desc: "Name, profile picture",
      icon: User,
      action: onOpenProfile,
    },
    {
      id: "privacy",
      title: "Privacy",
      desc: "Blocked contacts, last seen, online status, photo visibility",
      icon: Lock,
      action: () => setShowPrivacySettings(true),
    },
    {
      id: "social",
      title: "Social Circle",
      desc: "View and manage your followers and following lists",
      icon: Users,
      action: () => setShowFollowersFollowing(true),
    },
    {
      id: "chats",
      title: "Theme & Wallpaper",
      desc: "Theme Mode, Chat Wallpaper background settings",
      icon: MessageSquare,
      action: () => setShowThemeBackground(true),
    },
    {
      id: "help",
      title: "Help and feedback",
      desc: "Contact support and submit feedback",
      icon: HelpCircle,
      action: () => setShowHelpFeedback(true),
    },
  ];

  // Filter settings based on query
  const filteredItems = settingsItems.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <span className="text-app-text-primary font-semibold text-lg">Settings</span>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        
        {/* USER NAME TITLE */}
        <div className="px-6 pt-5 pb-2 text-left">
          <h2 className="text-app-text-primary text-2xl font-bold tracking-tight">
            {currentUser.username || "sabari"}
          </h2>
        </div>

        {/* INTERACTIVE SEARCH BAR */}
        <div className="px-6 py-3">
          <div className="bg-app-header rounded-xl flex items-center px-4 border border-app-border focus-within:border-brand transition-all duration-200">
            <Search size={18} className="text-app-text-secondary shrink-0" />
            <input
              type="text"
              placeholder="Search settings"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent outline-none px-3 py-3 text-sm text-app-text-primary placeholder-app-text-secondary"
            />
          </div>
        </div>

        {/* LARGE INTERACTIVE AVATAR CARD */}
        <div 
          onClick={onOpenProfile}
          className="mx-6 my-2 p-4 bg-app-header/40 border border-app-border rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-app-hover hover:border-app-border transition duration-200"
        >
          <div className="w-24 h-24 rounded-full bg-brand flex items-center justify-center overflow-hidden border border-app-border shadow-lg">
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-white text-3xl font-bold">
                {getInitials(currentUser.username)}
              </span>
            )}
          </div>
          <span className="text-app-text-secondary text-xs font-medium mt-3 uppercase tracking-wider">
            Click to edit profile settings
          </span>
        </div>

        {/* SETTINGS OPTIONS LIST */}
        <div className="flex-1 px-4 py-2 space-y-1">
          {filteredItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                onClick={item.action}
                className="w-full flex items-start gap-4 p-3.5 hover:bg-app-hover rounded-xl transition duration-150 text-left"
              >
                <div className="p-2 text-app-text-secondary bg-app-header rounded-xl shrink-0">
                  <IconComponent size={20} className="text-app-text-primary" />
                </div>
                <div className="flex-1 min-w-0 flex items-center justify-between">
                  <div>
                    <div className="text-app-text-primary text-sm font-semibold tracking-wide leading-tight">
                      {item.title}
                    </div>
                    <div className="text-app-text-secondary text-xs mt-0.5 leading-snug truncate">
                      {item.desc}
                    </div>
                  </div>
                  {item.badgeCount > 0 && (
                    <div className="bg-brand text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 shadow-sm animate-pulse mr-1">
                      {item.badgeCount}
                    </div>
                  )}
                </div>
              </button>
            );
          })}

          {/* LOG OUT BUTTON */}
          {filteredItems.length > 0 && (
            <button
              onClick={handleLogout}
              className="w-full flex items-start gap-4 p-3.5 hover:bg-[#ff003c]/10 rounded-xl transition duration-150 text-left mt-2 group border border-transparent hover:border-[#ff003c]/20"
            >
              <div className="p-2 text-red-500 bg-[#ff003c]/10 rounded-xl group-hover:bg-[#ff003c]/20 shrink-0 transition">
                <LogOut size={20} />
              </div>
              <div className="flex-1 pt-1">
                <span className="text-red-500 text-sm font-semibold tracking-wide leading-tight">
                  Log out
                </span>
              </div>
            </button>
          )}

          {filteredItems.length === 0 && (
            <div className="text-center text-app-text-secondary text-xs py-8">
              No matching settings found
            </div>
          )}
        </div>

      </div>
      {showPrivacySettings && (
        <PrivacySettingsDrawer onClose={() => setShowPrivacySettings(false)} />
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
      {showThemeBackground && (
        <ThemeBackgroundDrawer onClose={() => setShowThemeBackground(false)} />
      )}
      {showGeneralSettings && (
        <GeneralSettingsDrawer onClose={() => setShowGeneralSettings(false)} />
      )}
      {showHelpFeedback && (
        <HelpFeedbackDrawer onClose={() => setShowHelpFeedback(false)} />
      )}
      {showFollowersFollowing && (
        <FollowersFollowingDrawer 
          onClose={() => setShowFollowersFollowing(false)} 
          currentUserId={currentUser.id || currentUser._id}
          onOpenChat={onOpenChat}
        />
      )}
    </div>
  );
}

export default SettingsDrawer;
