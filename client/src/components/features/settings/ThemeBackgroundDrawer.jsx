import { useState, useRef } from "react";
import { ArrowLeft, Image as ImageIcon, Sliders, Moon, Sun, RotateCcw, Loader2 } from "lucide-react";
import { useTheme } from "@context/ThemeContext";
import { useEscapeKey } from "@hooks/useEscapeKey";
import toast from "react-hot-toast";
import api from "@services/api";

const PRESET_COLORS = [
  { name: "Teal Green", value: "#0b2520", lightValue: "#e1ebe8" },
  { name: "Mint Light", value: "#1e3c34", lightValue: "#d9fdd3" },
  { name: "Royal Purple", value: "#1f1a24", lightValue: "#f0edf5" },
  { name: "Deep Ocean", value: "#0c151c", lightValue: "#e4ebf0" },
  { name: "Dark Velvet", value: "#1a1010", lightValue: "#fbeeee" },
  { name: "Desert Sand", value: "#26231e", lightValue: "#f5f3e9" },
  { name: "Classic Slate", value: "#1e2225", lightValue: "#efebeb" },
  { name: "Midnight Black", value: "#000000", lightValue: "#e3e3e3" }
];

const PRESET_GRADIENTS = [
  { name: "Deep Space", value: "linear-gradient(135deg, #0b141a 0%, #1a2c38 100%)" },
  { name: "Aurora Green", value: "linear-gradient(135deg, #08241e 0%, #154734 100%)" },
  { name: "Night Sunset", value: "linear-gradient(135deg, #1b0a1a 0%, #3d1c3a 100%)" },
  { name: "Oceanic Dream", value: "linear-gradient(135deg, #031422 0%, #0d385c 100%)" }
];

function ThemeBackgroundDrawer({ onClose }) {
  const {
    theme,
    wallpaperType,
    wallpaperValue,
    wallpaperOpacity,
    updateAppearance,
    getWallpaperStyle
  } = useTheme();

  const [draftTheme, setDraftTheme] = useState(theme);
  const [draftType, setDraftType] = useState(wallpaperType);
  const [draftValue, setDraftValue] = useState(wallpaperValue);
  const [draftOpacity, setDraftOpacity] = useState(wallpaperOpacity);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Centralized ESC key support: close sub-drawer on Escape. Priority: 7
  useEscapeKey(onClose, true, 7);

  const handleThemeChange = (mode) => {
    setDraftTheme(mode);
    if (draftType === "color") {
      const col = PRESET_COLORS.find(c => c.value === draftValue || c.lightValue === draftValue);
      if (col) {
        setDraftValue(mode === "dark" ? col.value : col.lightValue);
      }
    }
  };

  const handleWallpaperChange = (type, value) => {
    setDraftType(type);
    setDraftValue(value);
  };

  const handleOpacityChange = (e) => {
    setDraftOpacity(parseInt(e.target.value));
  };

  const handleResetToDefault = () => {
    setDraftType("default");
    setDraftValue("");
    setDraftOpacity(100);
    toast.success("Preview reset to default! ✨");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("wallpaper", file);

      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const config = {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${userInfo.token}`,
        },
      };

      const { data } = await api.post("/user/appearance/wallpaper", formData, config);
      if (data && data.url) {
        setDraftType("custom");
        setDraftValue(data.url);
        toast.success("Wallpaper uploaded to preview! Click Save to apply. 🌅");
      }
    } catch (err) {
      console.error(err);
      toast.error("Image upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveChanges = async () => {
    try {
      setSaving(true);
      await updateAppearance({
        themeMode: draftTheme,
        wallpaperType: draftType,
        wallpaperValue: draftValue,
        wallpaperOpacity: draftOpacity,
      });
      toast.success("Appearance settings saved! ✨");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const previewStyle = getWallpaperStyle(draftType, draftValue, draftOpacity, draftTheme);

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-app-drawer text-app-text-primary animate-slide-in select-none">
      {/* HEADER */}
      <div className="h-[60px] bg-app-header flex items-center p-4 gap-4 border-b border-app-border shrink-0">
        <button onClick={onClose} className="p-1.5 text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover rounded-full transition cursor-pointer">
          <ArrowLeft size={20} />
        </button>
        <span className="text-app-text-primary font-semibold text-lg animate-fade-in">Theme & Wallpaper</span>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5 pb-12">
        
        {/* THEME PICKER */}
        <div className="flex flex-col gap-2.5">
          <span className="text-[10px] font-bold tracking-wider text-brand uppercase">Choose Theme</span>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleThemeChange("dark")}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition cursor-pointer ${
                draftTheme === "dark"
                  ? "bg-brand/15 border-brand text-brand font-semibold shadow-inner"
                  : "bg-app-header/40 border-app-border/60 text-app-text-secondary hover:bg-app-hover hover:text-app-text-primary"
              }`}
            >
              <Moon size={14} />
              <span className="text-xs font-bold">Dark Mode</span>
            </button>
            
            <button
              onClick={() => handleThemeChange("light")}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition cursor-pointer ${
                draftTheme === "light"
                  ? "bg-brand/15 border-brand text-brand font-semibold shadow-inner"
                  : "bg-app-header/40 border-app-border/60 text-app-text-secondary hover:bg-app-hover hover:text-app-text-primary"
              }`}
            >
              <Sun size={14} />
              <span className="text-xs font-bold">Light Mode</span>
            </button>
          </div>
        </div>

        {/* DYNAMIC LIVE CHAT SIMULATOR */}
        <div className="flex flex-col gap-2.5">
          <span className="text-[10px] font-bold tracking-wider text-brand uppercase">Live Preview Simulator</span>
          <div className="relative h-40 rounded-2xl border border-app-border/80 overflow-hidden bg-app-chat flex flex-col justify-end p-4 shadow-sm">
            
            <div style={previewStyle.backgroundStyle} className={previewStyle.className}></div>
            <div style={previewStyle.overlayStyle}></div>

            {/* Simulated Chat Messages */}
            <div className="relative z-10 w-full flex flex-col gap-2">
              <div className="flex items-end gap-2 max-w-[80%] self-start">
                <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center text-[9px] text-white font-bold shrink-0 shadow-sm border border-brand/20">
                  V
                </div>
                <div 
                  style={{
                    backgroundColor: "var(--bubble-incoming)"
                  }}
                  className="text-app-text-primary text-[10px] px-3 py-1.5 rounded-xl rounded-bl-none shadow border border-app-border/10 leading-relaxed font-medium"
                >
                  This live preview shows your new theme and wallpaper! ✨
                </div>
              </div>

              <div 
                style={{
                  backgroundColor: "var(--bubble-outgoing)"
                }}
                className="text-app-text-inverse text-[10px] px-3 py-1.5 rounded-xl rounded-br-none shadow max-w-[80%] self-end border border-app-border/10 leading-relaxed font-medium"
              >
                Wow, this looks absolutely stunning! 🚀
              </div>
            </div>
          </div>
        </div>

        {/* WALLPAPER DIMMING SLIDER */}
        {draftType !== "color" && (
          <div className="flex flex-col gap-2 border-t border-app-border/40 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider text-brand uppercase flex items-center gap-1.5">
                <Sliders size={12} />
                Wallpaper Dimming
              </span>
              <span className="text-xs text-app-text-secondary font-bold">{draftOpacity}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={draftOpacity}
              onChange={handleOpacityChange}
              className="w-full h-1 bg-app-header rounded-lg appearance-none cursor-pointer accent-brand"
            />
          </div>
        )}

        {/* WALLPAPER GALLERY */}
        <div className="flex flex-col gap-3.5 border-t border-app-border/40 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-brand uppercase">Select Wallpaper</span>
            <button
              onClick={handleResetToDefault}
              className="text-[10px] text-app-text-secondary hover:text-brand flex items-center gap-1 font-bold transition cursor-pointer"
              title="Reset wallpaper"
            >
              <RotateCcw size={10} />
              Reset Default
            </button>
          </div>

          {/* SOLID COLORS GRID */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-bold text-app-text-secondary uppercase tracking-wider">Solid Colors</span>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_COLORS.map((col) => {
                const colorVal = draftTheme === "dark" ? col.value : col.lightValue;
                const isSelected = draftType === "color" && draftValue === colorVal;
                return (
                  <button
                    key={col.name}
                    onClick={() => handleWallpaperChange("color", colorVal)}
                    style={{ backgroundColor: colorVal }}
                    className={`h-9 rounded-lg border relative transition active:scale-95 cursor-pointer ${
                      isSelected ? "border-brand ring-2 ring-brand/35 scale-[1.02]" : "border-app-border/30 hover:border-app-text-secondary"
                    }`}
                    title={col.name}
                  >
                    {isSelected && (
                      <span className="absolute inset-0 flex items-center justify-center text-xs text-brand drop-shadow-sm font-bold">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* GRADIENTS GRID */}
          <div className="flex flex-col gap-1.5 pt-1">
            <span className="text-[9px] font-bold text-app-text-secondary uppercase tracking-wider">Premium Gradients</span>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_GRADIENTS.map((grad) => {
                const isSelected = draftType === "gradient" && draftValue === grad.value;
                return (
                  <button
                    key={grad.name}
                    onClick={() => handleWallpaperChange("gradient", grad.value)}
                    style={{ background: grad.value }}
                    className={`h-11 rounded-xl border relative transition active:scale-95 flex items-center justify-center cursor-pointer ${
                      isSelected ? "border-brand ring-2 ring-brand/35 scale-[1.02]" : "border-app-border/30 hover:border-app-text-secondary"
                    }`}
                    title={grad.name}
                  >
                    <span className={`text-[10px] font-bold drop-shadow-md ${isSelected ? "text-brand" : "text-white"}`}>
                      {isSelected ? "Active ✓" : grad.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CUSTOM UPLOAD BOX */}
          <div className="pt-1">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept="image/*"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={`w-full py-3 rounded-xl border-2 border-dashed border-app-border/70 hover:border-brand/40 bg-app-header/15 flex flex-col items-center justify-center gap-1 cursor-pointer transition active:scale-98 ${
                uploading ? "opacity-50" : ""
              }`}
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin text-brand" size={20} />
                  <span className="text-[10px] font-bold text-brand">Uploading image...</span>
                </>
              ) : (
                <>
                  <ImageIcon className="text-app-text-secondary" size={20} />
                  <span className="text-xs font-bold text-app-text-primary">Upload Custom Wallpaper</span>
                  <span className="text-[9px] text-app-text-secondary">PNG, JPG or WebP</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* STICKY BOTTOM ACTIONS FOOTER */}
      <div className="p-4 bg-app-header border-t border-app-border flex items-center justify-end gap-3 shrink-0">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl border border-app-border text-app-text-secondary hover:bg-app-hover hover:text-app-text-primary text-xs font-bold transition active:scale-95 cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={handleSaveChanges}
          disabled={saving}
          className="px-5 py-2 rounded-xl bg-brand hover:bg-brand/90 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-brand/10 disabled:opacity-50 active:scale-95 cursor-pointer"
        >
          {saving ? (
            <>
              <Loader2 className="animate-spin" size={12} />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </button>
      </div>
    </div>
  );
}

export default ThemeBackgroundDrawer;
