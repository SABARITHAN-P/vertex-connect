import { useState, useEffect } from "react";
import api from "@services/api";
import { ArrowLeft, Sparkles, Sliders, Activity, Trash2, Cpu } from "lucide-react";
import { useEscapeKey } from "@hooks/useEscapeKey";
import toast from "react-hot-toast";

export default function AiSettingsDrawer({ onClose, conversation, onUpdateConversation, onClearHistory }) {
  const [models, setModels] = useState([]);
  const [ollamaConnected, setOllamaConnected] = useState(true);
  const [selectedModel, setSelectedModel] = useState(conversation?.model || "gemma:latest");
  const [temperature, setTemperature] = useState(conversation?.temperature || 0.7);
  const [maxTokens, setMaxTokens] = useState(conversation?.maxTokens || 2048);
  const [loading, setLoading] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  const [isCloud, setIsCloud] = useState(false);

  // Close on Escape key
  useEscapeKey(onClose, true, 5);

  // Fetch installed models
  useEffect(() => {
    const fetchModels = async () => {
      setLoadingModels(true);
      try {
        const { data } = await api.get("/ai/models");
        setModels(data.models || []);
        setOllamaConnected(data.ollamaConnected);
        setIsCloud(!!data.isCloud);
        
        // If current model is not in fetched models and we are connected, append it
        if (conversation && data.models && !data.models.includes(conversation.model)) {
          setModels(prev => [...prev, conversation.model]);
        }
      } catch (err) {
        console.error("Failed to load models:", err);
        setOllamaConnected(false);
        setIsCloud(false);
        setModels(["gemma:latest", "llama3:latest", "mistral:latest", "phi3:latest"]);
      } finally {
        setLoadingModels(false);
      }
    };
    fetchModels();
  }, [conversation]);

  const handleSaveSettings = async () => {
    if (!conversation) return;
    setLoading(true);
    try {
      const { data } = await api.put(`/ai/conversations/${conversation._id}`, {
        model: selectedModel,
        temperature: Number(temperature),
        maxTokens: Number(maxTokens),
      });
      onUpdateConversation(data);
      toast.success("AI Settings updated successfully!");
      onClose();
    } catch (err) {
      console.error("Failed to update AI settings:", err);
      toast.error("Failed to update settings");
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistoryClick = () => {
    if (confirm("Are you sure you want to clear all your AI conversations? This cannot be undone.")) {
      onClearHistory();
    }
  };

  return (
    <div className="absolute inset-0 bg-app-drawer text-app-text-primary z-50 flex flex-col transition-transform duration-300 transform translate-x-0 select-none">
      
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
        
        {/* MODEL SECTION */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand">
            <Cpu size={16} />
            <span>{isCloud ? "Select Cloud AI Model" : "Select Local AI Model"}</span>
          </div>
          
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={loadingModels}
            className="w-full bg-app-input text-app-text-primary text-sm rounded-xl p-3 border border-app-border outline-none focus:border-brand transition"
          >
            {loadingModels ? (
              <option>Loading models...</option>
            ) : (
              models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))
            )}
          </select>

          {isCloud ? (
            <p className="text-xs text-emerald-500 leading-normal mt-1 font-medium">
              ✨ Connected to Gemini Cloud API. Zero setup or local resources required.
            </p>
          ) : !ollamaConnected ? (
            <p className="text-xs text-amber-500 leading-normal mt-1">
              ⚠️ Ollama local server is offline. Run `ollama serve` and download models to enable local execution. Showing default configurations.
            </p>
          ) : (
            <p className="text-xs text-app-text-secondary leading-normal mt-1">
              Currently connected to local Ollama server. Detected {models.length} models installed.
            </p>
          )}
        </div>

        {/* TEMPERATURE SECTION */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-semibold text-brand">
            <div className="flex items-center gap-2">
              <Sliders size={16} />
              <span>Creativity (Temperature)</span>
            </div>
            <span className="text-xs font-mono bg-app-input px-2 py-0.5 rounded text-app-text-primary">
              {temperature}
            </span>
          </div>
          
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-app-input rounded-lg appearance-none cursor-pointer accent-brand"
          />

          <div className="flex justify-between text-[10px] text-app-text-secondary">
            <span>Precise / Codegen (0.0)</span>
            <span>Creative / Writing (1.0)</span>
          </div>
        </div>

        {/* MAX TOKENS SECTION */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand">
            <Activity size={16} />
            <span>Response Length (Max Tokens)</span>
          </div>
          
          <select
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value))}
            className="w-full bg-app-input text-app-text-primary text-sm rounded-xl p-3 border border-app-border outline-none focus:border-brand transition"
          >
            <option value={512}>512 Tokens (Short Replies)</option>
            <option value={1024}>1024 Tokens (Medium Replies)</option>
            <option value={2048}>2048 Tokens (Standard Length)</option>
            <option value={4096}>4096 Tokens (Long Explanations)</option>
          </select>
          <p className="text-xs text-app-text-secondary leading-normal">
            {isCloud ? "Limits the maximum size of the response generated by the cloud model." : "Limits the maximum size of the response generated by the local LLM to prevent long generation delays."}
          </p>
        </div>

        {/* ACTIONS */}
        <div className="pt-6 border-t border-app-border space-y-4">
          <button
            onClick={handleSaveSettings}
            disabled={loading}
            className="w-full bg-brand hover:opacity-90 text-white font-semibold py-3 rounded-xl transition cursor-pointer text-sm shadow-md"
          >
            {loading ? "Saving Settings..." : "Save Configuration"}
          </button>

          <button
            onClick={handleClearHistoryClick}
            className="w-full bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-600/20 hover:border-red-600/30 font-semibold py-3 rounded-xl transition cursor-pointer text-sm flex items-center justify-center gap-2"
          >
            <Trash2 size={16} />
            <span>Clear AI Conversations History</span>
          </button>
        </div>

      </div>
    </div>
  );
}
