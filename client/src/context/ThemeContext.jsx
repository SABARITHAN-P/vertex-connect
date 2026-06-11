import React, { createContext, useContext, useState, useEffect, useLayoutEffect } from "react";
import api from "@services/api";
import { socket } from "@socket/socket";

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  const [wallpaperType, setWallpaperType] = useState(() => localStorage.getItem("wallpaper_type") || "default");
  const [wallpaperValue, setWallpaperValue] = useState(() => localStorage.getItem("wallpaper_value") || "");
  const [wallpaperOpacity, setWallpaperOpacity] = useState(() => {
    const cached = localStorage.getItem("wallpaper_opacity");
    return cached !== null ? parseInt(cached) : 100;
  });

  // Font and display layouts
  const [fontSize, setFontSize] = useState(() => localStorage.getItem("font_size") || "medium");
  const [fontStyle, setFontStyle] = useState(() => localStorage.getItem("font_style") || "system");
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem("compact_mode") === "true");

  // Chat preferences
  const [enterToSend, setEnterToSend] = useState(() => {
    const cached = localStorage.getItem("enter_to_send");
    return cached !== null ? cached === "true" : true;
  });
  const [soundsEnabled, setSoundsEnabled] = useState(() => {
    const cached = localStorage.getItem("sounds_enabled");
    return cached !== null ? cached === "true" : true;
  });
  const [autoScroll, setAutoScroll] = useState(() => {
    const cached = localStorage.getItem("auto_scroll");
    return cached !== null ? cached === "true" : true;
  });

  // Apply theme to document element synchronously to prevent flashing/blinking
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.remove("dark");
    } else {
      root.classList.add("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Apply Font Size class
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.remove("text-sz-small", "text-sz-medium", "text-sz-large");
    root.classList.add(`text-sz-${fontSize}`);
    localStorage.setItem("font_size", fontSize);
  }, [fontSize]);

  // Apply Font Style class
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.remove(
      "font-st-system",
      "font-st-sans",
      "font-st-serif",
      "font-st-mono",
      "font-st-fredoka",
      "font-st-orbitron",
      "font-st-caveat",
      "font-st-cinzel",
      "font-st-dancing"
    );
    root.classList.add(`font-st-${fontStyle}`);
    localStorage.setItem("font_style", fontStyle);
  }, [fontStyle]);

  // Apply Compact Mode class
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (compactMode) {
      root.classList.add("compact-layout");
    } else {
      root.classList.remove("compact-layout");
    }
    localStorage.setItem("compact_mode", compactMode.toString());
  }, [compactMode]);

  // Save wallpaper info to localStorage
  useEffect(() => {
    localStorage.setItem("wallpaper_type", wallpaperType);
    localStorage.setItem("wallpaper_value", wallpaperValue);
    localStorage.setItem("wallpaper_opacity", wallpaperOpacity.toString());
  }, [wallpaperType, wallpaperValue, wallpaperOpacity]);

  // Save new settings to localStorage
  useEffect(() => {
    localStorage.setItem("enter_to_send", enterToSend.toString());
  }, [enterToSend]);

  useEffect(() => {
    localStorage.setItem("sounds_enabled", soundsEnabled.toString());
  }, [soundsEnabled]);

  useEffect(() => {
    localStorage.setItem("auto_scroll", autoScroll.toString());
  }, [autoScroll]);

  // Fetch appearance settings from the server
  const fetchAppearance = async () => {
    try {
      const { data } = await api.get("/user/appearance");
      if (data) {
        setTheme(data.themeMode || "dark");
        setWallpaperType(data.wallpaperType || "default");
        setWallpaperValue(data.wallpaperValue || "");
        setWallpaperOpacity(data.wallpaperOpacity !== undefined ? data.wallpaperOpacity : 100);

        // Sync custom general preferences
        if (data.fontSize) setFontSize(data.fontSize);
        if (data.fontStyle) setFontStyle(data.fontStyle);
        if (data.compactMode !== undefined) setCompactMode(data.compactMode);
        if (data.enterToSend !== undefined) setEnterToSend(data.enterToSend);
        if (data.soundsEnabled !== undefined) setSoundsEnabled(data.soundsEnabled);
        if (data.autoScroll !== undefined) setAutoScroll(data.autoScroll);
      }
    } catch (error) {
      console.error("Failed to fetch appearance settings:", error);
    }
  };

  // Update settings on server and locally
  const updateAppearance = async (settings) => {
    try {
      // Optimistic update locally
      if (settings.themeMode !== undefined) setTheme(settings.themeMode);
      if (settings.wallpaperType !== undefined) setWallpaperType(settings.wallpaperType);
      if (settings.wallpaperValue !== undefined) setWallpaperValue(settings.wallpaperValue);
      if (settings.wallpaperOpacity !== undefined) setWallpaperOpacity(settings.wallpaperOpacity);
      if (settings.fontSize !== undefined) setFontSize(settings.fontSize);
      if (settings.fontStyle !== undefined) setFontStyle(settings.fontStyle);
      if (settings.compactMode !== undefined) setCompactMode(settings.compactMode);
      if (settings.enterToSend !== undefined) setEnterToSend(settings.enterToSend);
      if (settings.soundsEnabled !== undefined) setSoundsEnabled(settings.soundsEnabled);
      if (settings.autoScroll !== undefined) setAutoScroll(settings.autoScroll);

      const { data } = await api.put("/user/appearance", settings);
      return data;
    } catch (error) {
      console.error("Failed to update appearance settings:", error);
      throw error;
    }
  };

  // Socket listener for real-time tab sync
  useEffect(() => {
    const handleAppearanceUpdate = (updatedSettings) => {
      if (updatedSettings) {
        if (updatedSettings.themeMode !== undefined) setTheme(updatedSettings.themeMode);
        if (updatedSettings.wallpaperType !== undefined) setWallpaperType(updatedSettings.wallpaperType);
        if (updatedSettings.wallpaperValue !== undefined) setWallpaperValue(updatedSettings.wallpaperValue);
        if (updatedSettings.wallpaperOpacity !== undefined) setWallpaperOpacity(updatedSettings.wallpaperOpacity);
        if (updatedSettings.fontSize !== undefined) setFontSize(updatedSettings.fontSize);
        if (updatedSettings.fontStyle !== undefined) setFontStyle(updatedSettings.fontStyle);
        if (updatedSettings.compactMode !== undefined) setCompactMode(updatedSettings.compactMode);
        if (updatedSettings.enterToSend !== undefined) setEnterToSend(updatedSettings.enterToSend);
        if (updatedSettings.soundsEnabled !== undefined) setSoundsEnabled(updatedSettings.soundsEnabled);
        if (updatedSettings.autoScroll !== undefined) setAutoScroll(updatedSettings.autoScroll);
      }
    };

    socket.on("appearance:updated", handleAppearanceUpdate);
    return () => {
      socket.off("appearance:updated", handleAppearanceUpdate);
    };
  }, []);

  // Compute CSS Style rule for chat window wallpaper
  const getWallpaperStyle = (overrideType, overrideValue, overrideOpacity, overrideTheme) => {
    const type = overrideType !== undefined ? overrideType : wallpaperType;
    const value = overrideValue !== undefined ? overrideValue : wallpaperValue;
    const opacity = overrideOpacity !== undefined ? overrideOpacity : wallpaperOpacity;
    const activeTheme = overrideTheme !== undefined ? overrideTheme : theme;

    const baseStyle = {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      zIndex: 0,
      pointerEvents: "none",
      transition: "all 0.3s ease",
    };

    // Dimming overlay
    const overlayOpacity = (100 - opacity) / 100;
    const overlayStyle = {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: activeTheme === "dark" ? "rgba(14, 22, 33, " + overlayOpacity + ")" : "rgba(248, 250, 252, " + overlayOpacity + ")",
      zIndex: 1,
      pointerEvents: "none",
      transition: "all 0.3s ease",
    };

    if (type === "default") {
      return {
        backgroundStyle: {
          ...baseStyle,
          backgroundColor: activeTheme === "dark" ? "#0e1621" : "#efeae2",
        },
        overlayStyle,
        className: "whatsapp-pattern",
      };
    }

    if (type === "color") {
      return {
        backgroundStyle: {
          ...baseStyle,
          backgroundColor: value || (activeTheme === "dark" ? "#090d16" : "#f8fafc"),
        },
        overlayStyle: {
          ...overlayStyle,
          backgroundColor: "transparent", // No overlay needed for solid color
        },
        className: "",
      };
    }

    if (type === "gradient") {
      return {
        backgroundStyle: {
          ...baseStyle,
          background: value || "linear-gradient(135deg, #0f2027, #203a43, #2c5364)",
        },
        overlayStyle,
        className: "",
      };
    }

    if (type === "custom") {
      return {
        backgroundStyle: {
          ...baseStyle,
          backgroundImage: `url(${value})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        },
        overlayStyle,
        className: "",
      };
    }

    return { backgroundStyle: {}, overlayStyle: {}, className: "" };
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        wallpaperType,
        wallpaperValue,
        wallpaperOpacity,
        fontSize,
        fontStyle,
        compactMode,
        enterToSend,
        soundsEnabled,
        autoScroll,
        setTheme,
        setWallpaperType,
        setWallpaperValue,
        setWallpaperOpacity,
        setFontSize,
        setFontStyle,
        setCompactMode,
        setEnterToSend,
        setSoundsEnabled,
        setAutoScroll,
        fetchAppearance,
        updateAppearance,
        getWallpaperStyle,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
