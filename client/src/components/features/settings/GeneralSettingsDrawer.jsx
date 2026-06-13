
import { 
  ArrowLeft, 
  Type, 
  Sliders, 
  Volume2, 
  MessageSquare, 
  Trash2,
  Check
} from "lucide-react";
import { useTheme } from "@context/ThemeContext";
import { useEscapeKey } from "@hooks/useEscapeKey";
import { premiumConfirm } from "@utils/alert";

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
    const confirmed = await premiumConfirm(
      "Restore Factory Settings",
      "Are you sure you want to reset all configurations to factory defaults? This clears cached preferences and reloads the window.",
      "warning"
    );
    if (confirmed) {
      try {
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
    <div className="absolute inset-0 bg-app-drawer text-app-text-primary z-50 flex flex-col transition-transform duration-300 transform translate-x-0 select-none animate-slide-in">
      {/* HEADER */}
      <div className="h-[60px] bg-app-header flex items-center p-4 gap-4 border-b border-app-border shrink-0">
        <button
          onClick={onClose}
          className="p-1.5 text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover rounded-full transition cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="text-app-text-primary font-semibold text-lg animate-fade-in">General Settings</span>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-12">
        
        {/* FONT STYLE SECTION */}
        <div className="bg-app-header/40 border border-app-border/80 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 text-brand bg-brand/10 rounded-xl">
              <Sliders size={18} />
            </div>
            <div>
              <h3 className="text-app-text-primary font-bold text-xs uppercase tracking-wider">Font Typography</h3>
              <p className="text-app-text-secondary text-[10px] mt-0.5">Select a gorgeous typeface style for chat overlays.</p>
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
                    : "bg-app-drawer/55 border-app-border/70 text-app-text-secondary hover:bg-app-hover hover:border-app-text-primary"
                }`}
              >
                <div className="min-w-0">
                  <div className={`text-xs font-semibold text-app-text-primary font-st-${styleOpt.id}`}>{styleOpt.name}</div>
                  <div className="text-[9px] text-app-text-secondary mt-0.5 truncate">{styleOpt.desc}</div>
                </div>
                {fontStyle === styleOpt.id && (
                  <Check size={14} className="text-brand shrink-0 ml-2" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* FONT SIZE SECTION */}
        <div className="bg-app-header/40 border border-app-border/80 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 text-brand bg-brand/10 rounded-xl">
              <Type size={18} />
            </div>
            <div>
              <h3 className="text-app-text-primary font-bold text-xs uppercase tracking-wider">Font Text Scale</h3>
              <p className="text-app-text-secondary text-[10px] mt-0.5">Adjust how large chat texts render.</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2">
            {fontSizesList.map((sz) => (
              <button
                key={sz.id}
                onClick={() => handleFontSizeChange(sz.id)}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-1 transition cursor-pointer ${
                  fontSize === sz.id
                    ? "bg-brand/15 border-brand text-brand font-semibold shadow-inner"
                    : "bg-app-drawer/55 border-app-border/70 text-app-text-secondary hover:bg-app-hover hover:border-app-text-primary"
                }`}
              >
                <span className="text-xs font-bold">{sz.name}</span>
                <span className="text-[8px] text-app-text-secondary leading-tight">{sz.desc.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* CHAT INTERACTION & LAYOUT SETTINGS */}
        <div className="bg-app-header/40 border border-app-border/80 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 text-brand bg-brand/10 rounded-xl">
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 className="text-app-text-primary font-bold text-xs uppercase tracking-wider">Chat Behavior & Displays</h3>
              <p className="text-app-text-secondary text-[10px] mt-0.5">Customize chat interactions and layout padding.</p>
            </div>
          </div>

          <div className="space-y-4 pt-2 divide-y divide-app-border/40">
            {/* Press Enter to Send */}
            <div className="flex items-center justify-between py-1">
              <div className="pr-4">
                <h4 className="text-app-text-primary text-xs font-semibold">Press Enter to Send</h4>
                <p className="text-app-text-secondary text-[10px] mt-0.5">Sends message on Enter. Shift+Enter creates a new line. When disabled, uses the send button.</p>
              </div>
              <button
                onClick={handleEnterToSendToggle}
                className={`w-10 h-5 rounded-full relative transition-colors duration-200 ease-in-out shrink-0 cursor-pointer focus:outline-none ${
                  enterToSend ? "bg-brand" : "bg-app-border"
                }`}
              >
                <span
                  className={`block w-3 h-3 rounded-full bg-white absolute top-1 left-1 transition-transform duration-200 ease-in-out ${
                    enterToSend ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Auto-Scroll on new message */}
            <div className="flex items-center justify-between pt-3.5">
              <div className="pr-4">
                <h4 className="text-app-text-primary text-xs font-semibold">Auto-Scroll on New Messages</h4>
                <p className="text-app-text-secondary text-[10px] mt-0.5">Keep scrolled to bottom automatically when new chat contents arrive.</p>
              </div>
              <button
                onClick={handleAutoScrollToggle}
                className={`w-10 h-5 rounded-full relative transition-colors duration-200 ease-in-out shrink-0 cursor-pointer focus:outline-none ${
                  autoScroll ? "bg-brand" : "bg-app-border"
                }`}
              >
                <span
                  className={`block w-3 h-3 rounded-full bg-white absolute top-1 left-1 transition-transform duration-200 ease-in-out ${
                    autoScroll ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Compact Mode */}
            <div className="flex items-center justify-between pt-3.5">
              <div className="pr-4">
                <h4 className="text-app-text-primary text-xs font-semibold">Compact Layout Mode</h4>
                <p className="text-app-text-secondary text-[10px] mt-0.5">Tighter padding inside message lists to display more active chat history.</p>
              </div>
              <button
                onClick={handleCompactModeToggle}
                className={`w-10 h-5 rounded-full relative transition-colors duration-200 ease-in-out shrink-0 cursor-pointer focus:outline-none ${
                  compactMode ? "bg-brand" : "bg-app-border"
                }`}
              >
                <span
                  className={`block w-3 h-3 rounded-full bg-white absolute top-1 left-1 transition-transform duration-200 ease-in-out ${
                    compactMode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* AUDITORY NOTIFICATION SETTINGS */}
        <div className="bg-app-header/40 border border-app-border/80 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 text-brand bg-brand/10 rounded-xl">
              <Volume2 size={18} />
            </div>
            <div>
              <h3 className="text-app-text-primary font-bold text-xs uppercase tracking-wider">UI Sound Effects</h3>
              <p className="text-app-text-secondary text-[10px] mt-0.5">Toggle sound-synthesis indicators.</p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="pr-4">
                <h4 className="text-app-text-primary text-xs font-semibold">Play Sound Effects</h4>
                <p className="text-app-text-secondary text-[10px] mt-0.5">Plays gentle chimes for inbound & outbound chat dispatches.</p>
              </div>
              <button
                onClick={handleSoundsToggle}
                className={`w-10 h-5 rounded-full relative transition-colors duration-200 ease-in-out shrink-0 cursor-pointer focus:outline-none ${
                  soundsEnabled ? "bg-brand" : "bg-app-border"
                }`}
              >
                <span
                  className={`block w-3 h-3 rounded-full bg-white absolute top-1 left-1 transition-transform duration-200 ease-in-out ${
                    soundsEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* SYSTEM UTILITIES & FACTORY RESET */}
        <div className="bg-app-header/40 border border-app-border/80 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 text-app-text-secondary bg-app-header border border-app-border/60 rounded-xl">
              <Trash2 size={18} />
            </div>
            <div>
              <h3 className="text-app-text-primary font-bold text-xs uppercase tracking-wider">Maintenance & Defaults</h3>
              <p className="text-app-text-secondary text-[10px] mt-0.5">Reset appearance and storage layouts.</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="pr-2">
                <h4 className="text-app-text-primary text-xs font-semibold">Restore Factory Settings</h4>
                <p className="text-app-text-secondary text-[10px] mt-0.5">Reset themes, wallpapers, fonts, and settings to system default values.</p>
              </div>
              <button
                onClick={handleResetCache}
                className="px-4 py-2 border border-app-border text-app-text-secondary hover:text-red-500 hover:border-red-500/30 rounded-xl transition font-semibold text-xs shrink-0 cursor-pointer text-center"
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
