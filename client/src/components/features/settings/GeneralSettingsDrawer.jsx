import React from "react";
import { 
  ArrowLeft, 
  Type, 
  Sliders, 
  Layout, 
  CheckCircle, 
  Volume2, 
  MessageSquare, 
  Sparkles, 
  Trash2 
} from "lucide-react";
import { useTheme } from "@context/ThemeContext";
import { useEscapeKey } from "@hooks/useEscapeKey";

function GeneralSettingsDrawer({ onClose }) {
  const {
    fontSize,
    fontStyle,
    compactMode,
    enterToSend,
    soundsEnabled,
    autoScroll,
    updateAppearance,
  } = useTheme();

  // Centralized ESC key support: close general settings drawer on Escape. Priority: 6
  useEscapeKey(onClose, true, 6);

  const fontStylesList = [
    { id: "system", name: "System Default", desc: "Standard sans-serif stack" },
    { id: "sans", name: "Modern Outfit", desc: "Clean geometric typeface" },
    { id: "serif", name: "Elegant Playfair", desc: "Classical editorial style" },
    { id: "mono", name: "Developer Code", desc: "Sleek SF Monospace style" },
    { id: "fredoka", name: "Fredoka Rounded", desc: "Cozy, warm, and friendly rounded look" },
    { id: "orbitron", name: "Orbitron Tech", desc: "Geometric sci-fi futuristic styling" },
    { id: "caveat", name: "Caveat Script", desc: "Natural and personal handwriting vibe" },
    { id: "cinzel", name: "Cinzel Classic", desc: "Luxury, grand Roman editorial design" },
    { id: "dancing", name: "Dancing Cursive", desc: "Lively, elegant script layout" },
  ];

  const fontSizesList = [
    { id: "small", name: "Small", desc: "Fits more text on screen" },
    { id: "medium", name: "Medium", desc: "Perfect standard scale" },
    { id: "large", name: "Large", desc: "Comfortable high visibility" },
  ];

  const handleFontSizeChange = async (szId) => {
    try {
      await updateAppearance({ fontSize: szId });
    } catch (err) {
      console.error("Failed to save font size setting:", err);
    }
  };

  const handleFontStyleChange = async (styleId) => {
    try {
      await updateAppearance({ fontStyle: styleId });
    } catch (err) {
      console.error("Failed to save font style setting:", err);
    }
  };

  const handleCompactModeToggle = async () => {
    try {
      await updateAppearance({ compactMode: !compactMode });
    } catch (err) {
      console.error("Failed to save compact mode setting:", err);
    }
  };

  const handleEnterToSendToggle = async () => {
    try {
      await updateAppearance({ enterToSend: !enterToSend });
    } catch (err) {
      console.error("Failed to save enter-to-send setting:", err);
    }
  };

  const handleSoundsToggle = async () => {
    try {
      await updateAppearance({ soundsEnabled: !soundsEnabled });
    } catch (err) {
      console.error("Failed to save sound settings:", err);
    }
  };

  const handleAutoScrollToggle = async () => {
    try {
      await updateAppearance({ autoScroll: !autoScroll });
    } catch (err) {
      console.error("Failed to save auto-scroll settings:", err);
    }
  };

  const handleResetCache = async () => {
    if (confirm("Are you sure you want to reset all configurations to factory defaults? This clears cached preferences and reloads the window.")) {
      try {
        // Reset appearance defaults on server
        await updateAppearance({
          themeMode: "dark",
          wallpaperType: "default",
          wallpaperValue: "",
          wallpaperOpacity: 100,
          fontSize: "medium",
          fontStyle: "system",
          compactMode: false,
          enterToSend: true,
          soundsEnabled: true,
          autoScroll: true
        });
        
        // Clear local storage preferences
        localStorage.removeItem("theme");
        localStorage.removeItem("wallpaper_type");
        localStorage.removeItem("wallpaper_value");
        localStorage.removeItem("wallpaper_opacity");
        localStorage.removeItem("font_size");
        localStorage.removeItem("font_style");
        localStorage.removeItem("compact_mode");
        localStorage.removeItem("enter_to_send");
        localStorage.removeItem("sounds_enabled");
        localStorage.removeItem("auto_scroll");
        
        window.location.reload();
      } catch (err) {
        console.error("Reset failed:", err);
      }
    }
  };

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
        <span className="text-app-text-primary font-semibold text-lg animate-fade-in">General Settings</span>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* FONT STYLE SECTION */}
        <div className="bg-app-header border border-app-border rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand/10 rounded-xl">
              <Sliders size={20} className="text-brand" />
            </div>
            <div>
              <h3 className="text-app-text-primary font-semibold text-sm">Font Typography</h3>
              <p className="text-app-text-secondary text-xs mt-0.5">Select a gorgeous typeface style for chat overlays.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            {fontStylesList.map((styleOpt) => (
              <button
                key={styleOpt.id}
                onClick={() => handleFontStyleChange(styleOpt.id)}
                className={`p-3 rounded-xl border flex items-center justify-between transition text-left cursor-pointer ${
                  fontStyle === styleOpt.id
                    ? "bg-brand/15 border-brand text-brand font-semibold shadow-inner"
                    : "bg-app-drawer border-app-border text-app-text-secondary hover:bg-app-hover hover:border-app-text-primary"
                }`}
              >
                <div className="min-w-0">
                  <div className={`text-xs font-semibold text-app-text-primary font-st-${styleOpt.id}`}>{styleOpt.name}</div>
                  <div className="text-[9px] text-app-text-secondary mt-0.5 truncate">{styleOpt.desc}</div>
                </div>
                {fontStyle === styleOpt.id && (
                  <CheckCircle size={15} className="text-brand shrink-0 ml-2" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* FONT SIZE SECTION */}
        <div className="bg-app-header border border-app-border rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand/10 rounded-xl">
              <Type size={20} className="text-brand" />
            </div>
            <div>
              <h3 className="text-app-text-primary font-semibold text-sm">Font Text Scale</h3>
              <p className="text-app-text-secondary text-xs mt-0.5">Adjust how large chat texts render.</p>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {fontSizesList.map((sz) => (
              <button
                key={sz.id}
                onClick={() => handleFontSizeChange(sz.id)}
                className={`w-full p-4 rounded-xl border flex items-center justify-between transition text-left cursor-pointer ${
                  fontSize === sz.id
                    ? "bg-brand/15 border-brand text-brand font-semibold shadow-inner"
                    : "bg-app-drawer border-app-border text-app-text-secondary hover:bg-app-hover hover:border-app-text-primary"
                }`}
              >
                <div>
                  <div className="text-xs font-semibold text-app-text-primary">{sz.name}</div>
                  <div className="text-[10px] text-app-text-secondary mt-0.5">{sz.desc}</div>
                </div>
                {fontSize === sz.id && (
                  <CheckCircle size={16} className="text-brand shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* CHAT INTERACTION & LAYOUT SETTINGS */}
        <div className="bg-app-header border border-app-border rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand/10 rounded-xl">
              <MessageSquare size={20} className="text-brand" />
            </div>
            <div>
              <h3 className="text-app-text-primary font-semibold text-sm">Chat Behavior & Displays</h3>
              <p className="text-app-text-secondary text-xs mt-0.5">Customize chat interactions and layout padding.</p>
            </div>
          </div>

          <div className="space-y-4 pt-2 divide-y divide-app-border/40">
            {/* Press Enter to Send */}
            <div className="flex items-center justify-between py-1">
              <div className="pr-3">
                <h4 className="text-app-text-primary text-xs font-semibold">Press Enter to Send</h4>
                <p className="text-app-text-secondary text-[10px] mt-0.5">Sends message on Enter. Shift+Enter creates a new line. When disabled, uses the send button.</p>
              </div>
              <button
                onClick={handleEnterToSendToggle}
                className={`w-12 h-6 rounded-full p-1 transition-all duration-200 ease-in-out shrink-0 cursor-pointer ${
                  enterToSend ? "bg-brand flex justify-end" : "bg-app-drawer border border-app-border flex justify-start"
                }`}
              >
                <div className={`w-4 h-4 rounded-full transition-transform ${enterToSend ? "bg-white" : "bg-app-text-secondary"}`} />
              </button>
            </div>

            {/* Auto-Scroll on new message */}
            <div className="flex items-center justify-between pt-3.5">
              <div className="pr-3">
                <h4 className="text-app-text-primary text-xs font-semibold">Auto-Scroll on New Messages</h4>
                <p className="text-app-text-secondary text-[10px] mt-0.5">Keep scrolled to bottom automatically when new chat contents arrive.</p>
              </div>
              <button
                onClick={handleAutoScrollToggle}
                className={`w-12 h-6 rounded-full p-1 transition-all duration-200 ease-in-out shrink-0 cursor-pointer ${
                  autoScroll ? "bg-brand flex justify-end" : "bg-app-drawer border border-app-border flex justify-start"
                }`}
              >
                <div className={`w-4 h-4 rounded-full transition-transform ${autoScroll ? "bg-white" : "bg-app-text-secondary"}`} />
              </button>
            </div>

            {/* Compact Mode */}
            <div className="flex items-center justify-between pt-3.5">
              <div className="pr-3">
                <h4 className="text-app-text-primary text-xs font-semibold">Compact Layout Mode</h4>
                <p className="text-app-text-secondary text-[10px] mt-0.5">Tighter padding inside message lists to display more active chat history.</p>
              </div>
              <button
                onClick={handleCompactModeToggle}
                className={`w-12 h-6 rounded-full p-1 transition-all duration-200 ease-in-out shrink-0 cursor-pointer ${
                  compactMode ? "bg-brand flex justify-end" : "bg-app-drawer border border-app-border flex justify-start"
                }`}
              >
                <div className={`w-4 h-4 rounded-full transition-transform ${compactMode ? "bg-white" : "bg-app-text-secondary"}`} />
              </button>
            </div>
          </div>
        </div>

        {/* AUDITORY NOTIFICATION SETTINGS */}
        <div className="bg-app-header border border-app-border rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand/10 rounded-xl">
              <Volume2 size={20} className="text-brand" />
            </div>
            <div>
              <h3 className="text-app-text-primary font-semibold text-sm">UI Sound Effects</h3>
              <p className="text-app-text-secondary text-xs mt-0.5">Toggle sound-synthesis indicators.</p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="pr-3">
                <h4 className="text-app-text-primary text-xs font-semibold">Play Sound Effects</h4>
                <p className="text-app-text-secondary text-[10px] mt-0.5">Plays gentle chimes for inbound & outbound chat dispatches.</p>
              </div>
              <button
                onClick={handleSoundsToggle}
                className={`w-12 h-6 rounded-full p-1 transition-all duration-200 ease-in-out shrink-0 cursor-pointer ${
                  soundsEnabled ? "bg-brand flex justify-end" : "bg-app-drawer border border-app-border flex justify-start"
                }`}
              >
                <div className={`w-4 h-4 rounded-full transition-transform ${soundsEnabled ? "bg-white" : "bg-app-text-secondary"}`} />
              </button>
            </div>
          </div>
        </div>

        {/* SYSTEM UTILITIES & FACTORY RESET */}
        <div className="bg-[#ff003c]/5 border border-[#ff003c]/15 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#ff003c]/15 rounded-xl">
              <Trash2 size={20} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-red-500 font-semibold text-sm">Maintenance & Defaults</h3>
              <p className="text-app-text-secondary text-xs mt-0.5">Reset appearance and storage layouts.</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-app-text-primary text-xs font-semibold">Restore Factory Settings</h4>
                <p className="text-app-text-secondary text-[10px] mt-0.5">Reset themes, wall-papers, fonts, and settings to the absolute system default values.</p>
              </div>
              <button
                onClick={handleResetCache}
                className="px-4 py-2 border border-[#ff003c]/35 text-red-500 rounded-xl hover:bg-[#ff003c]/15 transition font-semibold text-xs shrink-0 cursor-pointer text-center"
              >
                Clear Preferences
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default GeneralSettingsDrawer;
