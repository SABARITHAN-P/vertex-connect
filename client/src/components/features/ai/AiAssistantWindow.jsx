import { useState, useEffect, useRef } from "react";
import api from "@services/api";
import MarkdownRenderer from "@components/common/MarkdownRenderer";

import { 
  Send, 
  Bot, 
  Sparkles, 
  StopCircle, 
  Copy, 
  RotateCw, 
  X, 
  Check, 
  FileText, 
  ArrowDown,
  Info,
  ArrowLeft,
  Key
} from "lucide-react";
import toast from "react-hot-toast";

const API_BASE_URL = "http://localhost:5000/api";

const QUICK_PROMPTS = [
  { title: "Explain Code", desc: "Understand complex logic", prompt: "Explain the following code and how it works:\n\n```javascript\n\n```" },
  { title: "Fix a Bug", desc: "Find issues & suggest fixes", prompt: "Identify the bug in this code and write a corrected version:\n\n```javascript\n\n```" },
  { title: "Optimize Code", desc: "Improve performance", prompt: "Optimize this code for better time/space complexity:\n\n```javascript\n\n```" },
  { title: "SQL Helper", desc: "Generate database queries", prompt: "Write an optimized SQL query to: " },
  { title: "DSA Helper", desc: "Algorithms & complexity", prompt: "Explain how to solve this algorithm problem: " },
  { title: "Summarize Text", desc: "Extract key takeaways", prompt: "Summarize the key points of the following text:\n\n" },
];

export default function AiAssistantWindow({ conversation, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);

  const [prevConversationId, setPrevConversationId] = useState(conversation?._id);
  if (conversation?._id !== prevConversationId) {
    setPrevConversationId(conversation?._id);
    setAttachedFile(null);
    setInput("");
  }
  
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const abortControllerRef = useRef(null);

  const generatingRef = useRef(generating);
  useEffect(() => {
    generatingRef.current = generating;
  }, [generating]);

  // Load message history on conversation mount
  useEffect(() => {
    const activeConversationId = conversation?._id;
    if (!activeConversationId) return;
    
    // Stop any active generation
    if (generatingRef.current) {
      handleStopGeneration();
    }

    const fetchMessages = async () => {
      setLoading(true);
      setMessages([]);
      try {
        const { data } = await api.get(`/ai/conversations/${activeConversationId}/messages`);
        setMessages(data || []);
      } catch (err) {
        console.error("Failed to load AI messages:", err);
        toast.error("Failed to load message history");
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [conversation?._id]);

  // Scroll to bottom helper
  const scrollToBottom = (behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Scroll handler to toggle "Scroll to bottom" floating button
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    // Show button if user scrolls up by more than 300px
    const isUp = scrollHeight - scrollTop - clientHeight > 300;
    setShowScrollBottom(isUp);
  };

  useEffect(() => {
    if (generating) {
      scrollToBottom("smooth");
    }
  }, [messages, generating]);

  useEffect(() => {
    if (messages.length > 0 && !loading) {
      scrollToBottom("auto");
    }
  }, [loading, messages.length]);

  /* =========================================================
     MESSAGE SENDING (SSE STREAMING)
  ========================================================= */
  const handleSendMessage = async (e, customPrompt = null, isRegenerate = false) => {
    if (e) e.preventDefault();
    
    const messageContent = customPrompt || input;
    if (!messageContent.trim() && !attachedFile && !isRegenerate) return;

    if (generating) return;

    // Check if custom key is set before sending message
    if (!localStorage.getItem("vertex_custom_gemini_key")) {
      toast.error("Please add your Gemini API Key in Settings to start chatting.");
      sessionStorage.setItem("open_settings_ai", "true");
      window.dispatchEvent(new CustomEvent("open-settings-ai"));
      return;
    }

    // Build payload details
    const attachments = attachedFile ? [attachedFile] : [];
    const userInfo = JSON.parse(localStorage.getItem("userInfo"));
    const token = userInfo?.token;

    setGenerating(true);
    setInput("");
    setAttachedFile(null);

    // 1. Optimistically append user message to list (if not regenerating)
    if (!isRegenerate) {
      const tempUserMsg = {
        _id: Date.now().toString(),
        role: "user",
        content: messageContent,
        attachments,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, tempUserMsg]);
    }

    // 2. Append temporary blank assistant message for token streams
    const tempAssistantId = (Date.now() + 1).toString();
    setMessages(prev => [
      ...prev,
      {
        _id: tempAssistantId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      }
    ]);

    // 3. Initiate SSE Streaming Connection
    abortControllerRef.current = new AbortController();

    try {
      const customGeminiKey = localStorage.getItem("vertex_custom_gemini_key");
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      };
      if (customGeminiKey) {
        headers["x-gemini-key"] = customGeminiKey;
      }

      const response = await fetch(`${API_BASE_URL}/ai/conversations/${conversation._id}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          content: isRegenerate ? "" : messageContent,
          attachments,
          regenerate: isRegenerate,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to send message to AI server");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (done) break;

        const chunk = decoder.decode(value);
        // Process SSE lines
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const payload = JSON.parse(line.replace("data: ", ""));
              
              if (payload.token) {
                // Update final character streaming (non-mutating for React Strict Mode safety)
                setMessages(prev => {
                  const copy = [...prev];
                  const idx = copy.findIndex(m => m._id === tempAssistantId);
                  if (idx !== -1) {
                    copy[idx] = {
                      ...copy[idx],
                      content: copy[idx].content + payload.token
                    };
                  }
                  return copy;
                });
              }

              if (payload.done) {
                // Replace temp message with server saved message schema
                if (payload.message) {
                  setMessages(prev => {
                    const copy = [...prev];
                    const idx = copy.findIndex(m => m._id === tempAssistantId);
                    if (idx !== -1) {
                      copy[idx] = payload.message;
                    }
                    return copy;
                  });
                }
                done = true;
              }
            } catch {
              // skip incomplete chunk lines
            }
          }
        }
      }
    } catch (err) {
      if (err.name === "AbortError") {
        console.log("Response streaming was aborted by client.");
      } else {
        console.error("Streaming error:", err);
        toast.error("Generation failed. Check connection.");
        // Clean up last message if empty
        setMessages(prev => {
          const copy = [...prev];
          if (copy[copy.length - 1]?.content === "") {
            copy.pop();
          }
          return copy;
        });
      }
    } finally {
      setGenerating(false);
      abortControllerRef.current = null;
      window.dispatchEvent(new CustomEvent("ai-conversations-updated"));
    }
  };

  function handleStopGeneration() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setGenerating(false);
      toast.success("Generation stopped.");
    }
  }

  const handleRegenerate = () => {
    if (messages.length < 2) return;
    
    // Find last user message
    let lastUserMessageIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserMessageIdx = i;
        break;
      }
    }

    if (lastUserMessageIdx === -1) return;

    // Truncate message history back to user message, removing subsequent responses
    setMessages(prev => prev.slice(0, lastUserMessageIdx + 1));
    handleSendMessage(null, null, true);
  };

  const handleCopyMessageText = async (msgId, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(msgId);
      setTimeout(() => setCopiedMessageId(null), 2000);
      toast.success("Message copied to clipboard!");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-app-chat text-app-text-primary relative overflow-hidden">
      
      {/* HEADER */}
      <div className="h-[60px] bg-app-header border-b border-app-border flex items-center justify-between px-6 z-10 select-none">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-1.5 text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover rounded-full transition cursor-pointer shrink-0 mr-1"
              title="Back to Sidebar"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="w-10 h-10 rounded-full bg-brand/15 flex items-center justify-center border border-brand/30 shrink-0">
            <Sparkles size={20} className="text-brand" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-app-text-primary flex items-center gap-1.5">
              <span>Vertex AI Assistant</span>
            </h1>
          </div>
        </div>

      </div>

      {/* CHAT AREA */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-app-text-secondary text-sm gap-2 mt-20">
            <div className="w-8 h-8 border-4 border-brand/30 border-t-brand rounded-full animate-spin"></div>
            <span>Loading conversation...</span>
          </div>
        ) : messages.length === 0 ? (
          /* EMPTY STATE (Dashboard cards) */
          <div className="max-w-2xl mx-auto flex flex-col justify-center min-h-[75%] py-8">
            <div className="text-center space-y-3 mb-8">
              <div className="w-16 h-16 rounded-3xl bg-brand/10 border border-brand/20 flex items-center justify-center mx-auto shadow-md animate-pulse">
                <Bot size={36} className="text-brand" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">How can I help you today?</h2>
              <p className="text-app-text-secondary text-sm max-w-md mx-auto leading-normal">
                Ask coding questions, refactor algorithms, debug database queries, or upload files for summarization. Fully offline execution, zero usage cost.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {QUICK_PROMPTS.map((p, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setInput(p.prompt);
                    // Autofocus input
                    document.getElementById("ai-prompt-input")?.focus();
                  }}
                  className="p-4 bg-app-card hover:bg-app-hover border border-app-border rounded-xl cursor-pointer transition-all duration-200 text-left hover:-translate-y-0.5 shadow-sm group"
                >
                  <span className="text-sm font-semibold text-app-text-primary group-hover:text-brand transition">
                    {p.title}
                  </span>
                  <p className="text-xs text-app-text-secondary mt-1 leading-snug">
                    {p.desc}
                  </p>
                </div>
              ))}
            </div>
            
            {!localStorage.getItem("vertex_custom_gemini_key") ? (
              <div className="mt-8 bg-brand/5 border border-brand/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
                <div className="flex items-start gap-3 text-left">
                  <div className="w-8 h-8 rounded-xl bg-brand/10 flex items-center justify-center text-brand shrink-0 mt-0.5">
                    <Key size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-app-text-primary">Gemini API Key Required</h4>
                    <p className="text-[11px] text-app-text-secondary mt-1 leading-normal">
                      To start chatting with the Vertex AI Assistant, please add your custom Gemini API key in settings.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    sessionStorage.setItem("open_settings_ai", "true");
                    window.dispatchEvent(new CustomEvent("open-settings-ai"));
                  }}
                  className="w-full sm:w-auto px-4 py-2 bg-brand text-white font-semibold rounded-xl text-xs hover:opacity-90 transition cursor-pointer text-center shrink-0 shadow-sm"
                >
                  Configure Key
                </button>
              </div>
            ) : (
              <div className="mt-8 bg-app-input border border-app-border rounded-xl p-3.5 flex items-start gap-3">
                <Info size={16} className="text-brand shrink-0 mt-0.5" />
                <p className="text-xs text-app-text-secondary leading-normal text-left">
                  To start a new session, close this chat and click <strong>New Chat</strong>. You are currently using your own private Gemini API Key.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* MESSAGE STREAM */
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg, idx) => {
              const isAi = msg.role === "assistant";
              return (
                <div
                  key={msg._id || idx}
                  className={`flex gap-4 ${isAi ? "justify-start" : "justify-end"}`}
                >
                  {/* Avatar for AI */}
                  {isAi && (
                    <div className="w-8 h-8 rounded-lg bg-brand/15 border border-brand/30 flex items-center justify-center shrink-0 shadow-sm mt-1">
                      <Sparkles size={16} className="text-brand" />
                    </div>
                  )}

                  {/* Message Bubble Container */}
                  <div className="max-w-[85%] space-y-1.5">
                    {/* Render attachment chip if user sent document */}
                    {!isAi && msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-col gap-1 items-end">
                        {msg.attachments.map((att, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-app-input border border-app-border rounded-lg text-xs">
                            <FileText size={14} className="text-emerald-400" />
                            <span className="font-semibold text-app-text-secondary truncate max-w-[150px]">{att.fileName}</span>
                            <span className="text-[10px] text-gray-500">({Math.round(att.fileSize / 1024)} KB)</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Content Area */}
                    <div
                      className={`px-4 py-3 rounded-2xl shadow-sm text-left ${
                        isAi
                          ? "bg-app-bubble-incoming border border-app-border/40 text-app-text-primary"
                          : "bg-brand text-white rounded-tr-none font-medium animate-fade-in"
                      }`}
                    >
                      {isAi ? (
                        msg.content === "" ? (
                          /* Loading tokens pulse */
                          <div className="flex items-center gap-1 py-1">
                            <span className="w-2 h-2 bg-brand rounded-full animate-bounce"></span>
                            <span className="w-2 h-2 bg-brand rounded-full animate-bounce delay-100"></span>
                            <span className="w-2 h-2 bg-brand rounded-full animate-bounce delay-200"></span>
                          </div>
                        ) : (
                          <MarkdownRenderer content={msg.content} />
                        )
                      ) : (
                        <p className="whitespace-pre-wrap text-sm break-words leading-relaxed">{msg.content}</p>
                      )}
                    </div>

                    {/* Metadata / Actions Bar */}
                    {isAi && msg.content !== "" && (
                      <div className="flex items-center gap-3 px-1 text-[11px] text-app-text-secondary select-none">
                        <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        
                        <button
                          onClick={() => handleCopyMessageText(msg._id, msg.content)}
                          className="hover:text-app-text-primary transition flex items-center gap-1 cursor-pointer"
                        >
                          {copiedMessageId === msg._id ? (
                            <>
                              <Check size={12} className="text-emerald-500" />
                              <span className="text-emerald-500">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        {/* Regenerate trigger on the last assistant message */}
                        {idx === messages.length - 1 && !generating && (
                          <button
                            onClick={handleRegenerate}
                            className="hover:text-app-text-primary transition flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCw size={12} />
                            <span>Regenerate</span>
                          </button>
                        )}
                      </div>
                    )}

                    {!isAi && (
                      <div className="text-right px-1 text-[10px] text-app-text-secondary select-none">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* FLOATING SCROLL BOTTOM BUTTON */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-24 right-8 bg-brand hover:opacity-95 text-white p-3 rounded-full shadow-lg transition-transform hover:scale-105 duration-200 cursor-pointer animate-bounce z-10 border border-brand/20"
          title="Scroll to Bottom"
        >
          <ArrowDown size={18} />
        </button>
      )}

      {/* BOTTOM INPUT FORM */}
      <div className="p-4 bg-app-header border-t border-app-border z-10">
        <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto space-y-2">
          
          {/* File Preview Chip */}
          {attachedFile && (
            <div className="flex items-center gap-2.5 px-3 py-2 bg-app-input border border-app-border rounded-xl w-fit animate-fade-in shadow-sm select-none">
              <FileText size={16} className="text-brand" />
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-app-text-primary truncate max-w-[200px]">
                  {attachedFile.fileName}
                </span>
                <span className="text-[10px] text-app-text-secondary">
                  Document Content Loaded ({Math.round(attachedFile.fileSize / 1024)} KB)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAttachedFile(null)}
                className="text-app-text-secondary hover:text-white transition cursor-pointer p-0.5 rounded-full hover:bg-app-hover ml-2"
                title="Remove File"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Text Input Row */}
          <div className="flex items-end gap-2.5 bg-app-input rounded-2xl p-2.5 border border-app-border focus-within:border-brand/60 transition-colors">
            


            {/* Input Text Area */}
            <textarea
              id="ai-prompt-input"
              rows={Math.min(4, input.split("\n").length || 1)}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends prompt, Shift+Enter inserts newline
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={generating}
              placeholder="Ask anything..."
              className="flex-1 bg-transparent border-0 outline-none text-sm text-app-text-primary placeholder-app-text-secondary/60 resize-none max-h-32 py-1.5 px-2 select-text"
            />

            {/* Stream Control Action */}
            {generating ? (
              <button
                type="button"
                onClick={handleStopGeneration}
                className="p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition cursor-pointer shrink-0 shadow-sm"
                title="Stop Generation"
              >
                <StopCircle size={18} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() && !attachedFile}
                className="p-2.5 bg-brand hover:opacity-90 text-white rounded-xl transition cursor-pointer shrink-0 shadow-sm disabled:opacity-40"
                title="Send Prompt"
              >
                <Send size={18} />
              </button>
            )}
          </div>
        </form>
      </div>



    </div>
  );
}
