import { useState } from "react";
import { ArrowLeft, Key, ExternalLink, HelpCircle } from "lucide-react";
import { useEscapeKey } from "@hooks/useEscapeKey";
import toast from "react-hot-toast";
import api from "@services/api";

export default function AiSettingsDrawer({ onClose, currentUser, setCurrentUser }) {
  const [customApiKey, setCustomApiKey] = useState(
    currentUser?.customAiApiKey || localStorage.getItem("vertex_custom_gemini_key") || ""
  );
  const [loading, setLoading] = useState(false);

  // Close on Escape key
  useEscapeKey(onClose, true, 5);

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const trimmedKey = customApiKey.trim();
      
      // Save key to the server database
      await api.put("/user/ai-key", { customAiApiKey: trimmedKey });
      
      // Update local storage userInfo object
      const userInfoLocal = JSON.parse(localStorage.getItem("userInfo") || "{}");
      const updatedUser = { ...userInfoLocal, customAiApiKey: trimmedKey };
      localStorage.setItem("userInfo", JSON.stringify(updatedUser));
      
      // Update global React context state
      setCurrentUser?.(updatedUser);

      // Legacy fallback
      if (trimmedKey) {
        localStorage.setItem("vertex_custom_gemini_key", trimmedKey);
        toast.success("Custom Gemini API Key saved & synced across devices!");
      } else {
        localStorage.removeItem("vertex_custom_gemini_key");
        toast.success("Custom key removed. Using default server key.");
      }
      onClose();
    } catch (err) {
      console.error("Failed to save AI key:", err);
      toast.error(err.response?.data?.message || "Failed to save settings");
    } finally {
      setLoading(false);
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
        <span className="text-app-text-primary font-semibold text-lg">AI Assistant Settings</span>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* INSTRUCTIONS GUIDE */}
        <div className="bg-app-header/40 border border-app-border/60 rounded-xl p-4 space-y-3.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand">
            <HelpCircle size={16} />
            <span>How to get your free API Key</span>
          </div>
          
          <ol className="text-xs text-app-text-secondary space-y-2.5 list-decimal pl-4 leading-relaxed text-left">
            <li>
              Go to the{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand hover:underline inline-flex items-center gap-0.5 font-medium"
              >
                Google AI Studio Key Manager
                <ExternalLink size={10} className="inline" />
              </a>.
            </li>
            <li>
              Sign in with your standard Google Account.
            </li>
            <li>
              Click the blue <strong>Create API Key</strong> button at the top left.
            </li>
            <li>
              Choose <strong>Create API key in new project</strong> (or select an existing Google Cloud project).
            </li>
            <li>
              Copy the generated key (starts with <code>AIzaSy...</code>) and paste it in the field below.
            </li>
          </ol>
        </div>

        {/* CUSTOM API KEY INPUT */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand">
            <Key size={16} />
            <span>Custom Gemini API Key</span>
          </div>
          
          <input
            type="password"
            placeholder="Paste your Gemini API Key here..."
            value={customApiKey}
            onChange={(e) => setCustomApiKey(e.target.value)}
            className="w-full bg-app-input text-app-text-primary text-sm rounded-xl p-3.5 border border-app-border outline-none focus:border-brand transition font-mono"
          />
          
          <p className="text-[11px] text-app-text-secondary leading-normal text-left">
            Your custom key is saved directly in your browser's local storage for privacy. It is sent to Google's API to handle requests and is never stored on our servers. Leaving this field blank will fallback to the server's default shared API key.
          </p>
        </div>

        {/* ACTIONS */}
        <div className="pt-4 border-t border-app-border/40 space-y-4">
          <button
            onClick={handleSaveSettings}
            disabled={loading}
            className="w-full bg-brand hover:opacity-90 text-white font-semibold py-3 rounded-xl transition cursor-pointer text-sm shadow-md"
          >
            {loading ? "Saving Settings..." : "Save Configuration"}
          </button>
        </div>

      </div>
    </div>
  );
}
