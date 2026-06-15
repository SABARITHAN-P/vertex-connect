/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import PrivacySettingsDrawer from "@components/features/settings/PrivacySettingsDrawer";
import FollowRequestsDrawer from "@components/features/social/FollowRequestsDrawer";
import ThemeBackgroundDrawer from "@components/features/settings/ThemeBackgroundDrawer";
import GeneralSettingsDrawer from "@components/features/settings/GeneralSettingsDrawer";
import HelpFeedbackDrawer from "@components/features/settings/HelpFeedbackDrawer";
import FollowersFollowingDrawer from "@components/features/social/FollowersFollowingDrawer";
import AiSettingsDrawer from "@components/features/ai/AiSettingsDrawer";
import api from "@services/api";
import { 
  ArrowLeft, 
  Search, 
  Monitor, 
  User, 
  Lock, 
  MessageSquare, 
  HelpCircle, 
  LogOut,
  Users,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { useEscapeKey } from "@hooks/useEscapeKey";
import { premiumConfirm } from "@utils/alert";
import toast from "react-hot-toast";

function SettingsDrawer({ onClose, currentUser, onOpenProfile, onOpenChat }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [showFollowRequests, setShowFollowRequests] = useState(false);
  const [showThemeBackground, setShowThemeBackground] = useState(false);
  const [showGeneralSettings, setShowGeneralSettings] = useState(false);
  const [showHelpFeedback, setShowHelpFeedback] = useState(false);
  const [showFollowersFollowing, setShowFollowersFollowing] = useState(false);
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [showPasswordVerification, setShowPasswordVerification] = useState(false);
  const [verifyPasswordText, setVerifyPasswordText] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [requestCount, setRequestCount] = useState(0);

  // Centralized ESC key support: close settings drawer on Escape. Priority: 5
  useEscapeKey(onClose, true, 5);

  const handleVerifyPasswordSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!verifyPasswordText) return;
    setVerifying(true);
    try {
      const { data } = await api.post("/auth/verify-password", { password: verifyPasswordText });
      if (data.success) {
        setShowPasswordVerification(false);
        setVerifyPasswordText("");
        setShowAiSettings(true);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Incorrect password. Please try again.");
    } finally {
      setVerifying(false);
    }
  };



  const fetchRequestCount = async () => {
    try {
      const { data } = await api.get("/user/follow/requests");
      setRequestCount(data.length);
    } catch (error) {
      console.error("Failed to fetch follow requests count:", error);
    }
  };

  useEffect(() => {
    fetchRequestCount();

    const handleOpenSettingsAi = () => {
      setShowPasswordVerification(true);
    };

    if (sessionStorage.getItem("open_settings_ai") === "true") {
      sessionStorage.removeItem("open_settings_ai");
      setShowPasswordVerification(true);
    }

    window.addEventListener("open-settings-ai", handleOpenSettingsAi);
    return () => {
      window.removeEventListener("open-settings-ai", handleOpenSettingsAi);
    };
  }, []);

  const handleLogout = async () => {
    const confirmed = await premiumConfirm("Log Out", "Are you sure you want to log out of Vertex Connect?", "warning");
    if (confirmed) {
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
      desc: "Name, profile picture, status",
      icon: User,
      action: onOpenProfile,
    },
    {
      id: "privacy",
      title: "Privacy",
      desc: "Who can add you to groups, blocked contacts, last seen status",
      icon: Lock,
      action: () => setShowPrivacySettings(true),
    },
    {
      id: "social",
      title: "Social Circle",
      desc: "View and manage your followers and following lists",
      icon: Users,
      action: () => setShowFollowersFollowing(true),
      badgeCount: requestCount,
    },
    {
      id: "chats",
      title: "Theme & Wallpaper",
      desc: "Theme Mode, Chat Wallpaper background settings",
      icon: MessageSquare,
      action: () => setShowThemeBackground(true),
    },
    {
      id: "ai",
      title: "AI Assistant",
      desc: "Configure your custom Gemini API Key",
      icon: Sparkles,
      action: () => setShowPasswordVerification(true),
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
    <div className="absolute inset-0 bg-app-drawer text-app-text-primary z-50 flex flex-col transition-transform duration-300 transform translate-x-0 select-none animate-slide-in">
      
      {/* HEADER */}
      <div className="h-[60px] bg-app-header flex items-center p-4 gap-4 border-b border-app-border/80 shrink-0">
        <button
          onClick={onClose}
          className="p-1.5 text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover rounded-full transition cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="text-app-text-primary font-semibold text-lg animate-fade-in">Settings</span>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto flex flex-col pb-6">
        
        {/* INTERACTIVE SEARCH BAR */}
        <div className="px-6 pt-5 pb-2">
          <div className="bg-app-header rounded-xl flex items-center px-4 border border-app-border/80 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand/35 transition-all duration-200">
            <Search size={16} className="text-app-text-secondary shrink-0" />
            <input
              type="text"
              placeholder="Search settings"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent outline-none px-3 py-3 text-xs text-app-text-primary placeholder-app-text-secondary"
            />
          </div>
        </div>

        {/* INTERACTIVE PROFILE BANNER */}
        <div 
          onClick={onOpenProfile}
          className="mx-6 my-3 p-4 bg-app-header/40 border border-app-border/60 rounded-xl flex items-center gap-4 cursor-pointer hover:bg-app-hover hover:border-app-border transition duration-200"
        >
          <div className="w-14 h-14 rounded-full bg-brand flex items-center justify-center overflow-hidden border border-app-border/40 shrink-0">
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-white text-xl font-bold">
                {getInitials(currentUser.username)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-app-text-primary text-sm font-semibold truncate">
              {currentUser.username || "User"}
            </h3>
            <p className="text-app-text-secondary text-[11px] mt-0.5 truncate">
              {currentUser.about || currentUser.status || "Hey there! I am using Vertex Connect."}
            </p>
            <span className="text-[10px] text-app-text-secondary/80 mt-1 block">
              View and edit profile settings
            </span>
          </div>
        </div>

        {/* SETTINGS OPTIONS LIST */}
        <div className="flex-1 px-6 py-2 space-y-1.5">
          {filteredItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                onClick={item.action}
                className="w-full flex items-center gap-4 p-3.5 bg-app-header/20 border border-app-border/40 hover:bg-app-hover hover:border-app-border rounded-xl transition duration-150 text-left cursor-pointer group"
              >
                <div className="p-2 text-app-text-secondary bg-app-header border border-app-border/60 rounded-xl shrink-0 group-hover:text-brand group-hover:border-brand/30 transition">
                  <IconComponent size={18} />
                </div>
                <div className="flex-1 min-w-0 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <div className="text-app-text-primary text-xs font-semibold tracking-wide leading-tight group-hover:text-brand transition-colors">
                      {item.title}
                    </div>
                    <div className="text-app-text-secondary text-[10px] mt-0.5 leading-snug truncate">
                      {item.desc}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.badgeCount > 0 && (
                      <div className="bg-brand text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse mr-1">
                        {item.badgeCount}
                      </div>
                    )}
                    <ChevronRight size={14} className="text-app-text-secondary/60 group-hover:text-brand transition-colors transform group-hover:translate-x-0.5 duration-200" />
                  </div>
                </div>
              </button>
            );
          })}

          {/* LOG OUT BUTTON */}
          {filteredItems.length > 0 && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-4 p-3.5 bg-app-header/20 border border-app-border/40 hover:bg-app-hover hover:border-red-500/10 rounded-xl transition duration-150 text-left cursor-pointer group"
            >
              <div className="p-2 text-app-text-secondary bg-app-header border border-app-border/60 rounded-xl shrink-0 group-hover:text-red-500 group-hover:border-red-500/30 transition">
                <LogOut size={18} />
              </div>
              <div className="flex-1 min-w-0 flex items-center justify-between">
                <div>
                  <div className="text-app-text-primary text-xs font-semibold tracking-wide leading-tight group-hover:text-red-500 transition-colors">
                    Log out
                  </div>
                  <div className="text-app-text-secondary text-[10px] mt-0.5 leading-snug">
                    Sign out of your active session
                  </div>
                </div>
                <ChevronRight size={14} className="text-app-text-secondary/60 group-hover:text-red-500 transition-colors transform group-hover:translate-x-0.5 duration-200" />
              </div>
            </button>
          )}

          {filteredItems.length === 0 && (
            <div className="text-center text-app-text-secondary text-xs py-8 bg-app-header/25 rounded-xl border border-dashed border-app-border/60">
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
      {showAiSettings && (
        <AiSettingsDrawer onClose={() => setShowAiSettings(false)} />
      )}
      {showPasswordVerification && (
        <div className="absolute inset-0 bg-app-drawer text-app-text-primary z-50 flex flex-col transition-transform duration-300 transform translate-x-0 select-none animate-slide-in">
          {/* HEADER */}
          <div className="h-[60px] bg-app-header flex items-center p-4 gap-4 border-b border-app-border shrink-0">
            <button
              onClick={() => {
                setShowPasswordVerification(false);
                setVerifyPasswordText("");
              }}
              className="p-1.5 text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover rounded-full transition cursor-pointer"
            >
              <ArrowLeft size={20} />
            </button>
            <span className="text-app-text-primary font-semibold text-lg">Identity Verification</span>
          </div>

          {/* BODY */}
          <div className="flex-1 flex flex-col justify-center items-center p-6 space-y-6">
            <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center text-brand">
              <Lock size={28} />
            </div>

            <div className="text-center space-y-2 max-w-sm">
              <h3 className="text-base font-bold text-app-text-primary">Confirm Your Password</h3>
              <p className="text-xs text-app-text-secondary leading-normal">
                To access your sensitive AI Assistant settings and API keys, please verify your identity by entering your password.
              </p>
            </div>

            <form onSubmit={handleVerifyPasswordSubmit} className="w-full max-w-sm space-y-4">
              <input
                type="password"
                placeholder="Enter your account password"
                value={verifyPasswordText}
                onChange={(e) => setVerifyPasswordText(e.target.value)}
                className="w-full bg-app-input text-app-text-primary text-sm rounded-xl p-3.5 border border-app-border outline-none focus:border-brand transition text-center"
                autoFocus
              />

              <button
                type="submit"
                disabled={verifying}
                className="w-full bg-brand hover:opacity-90 text-white font-semibold py-3.5 rounded-xl transition cursor-pointer text-sm shadow-md"
              >
                {verifying ? "Verifying..." : "Verify Password"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsDrawer;
