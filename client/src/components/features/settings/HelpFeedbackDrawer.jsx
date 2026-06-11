import { useState } from "react";
import { ArrowLeft, HelpCircle, Send, CheckCircle2, AlertCircle } from "lucide-react";
import api from "@services/api";
import { useEscapeKey } from "@hooks/useEscapeKey";

function HelpFeedbackDrawer({ onClose }) {
  const [issue, setIssue] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Centralized ESC key support: close feedback drawer on Escape. Priority: 6
  useEscapeKey(onClose, true, 6);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!issue.trim()) {
      setErrorMsg("Please specify the issue summary.");
      return;
    }
    if (!details.trim()) {
      setErrorMsg("Please provide some details regarding the issue.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg("");

      await api.post("/user/feedback", { 
        issue: issue.trim(), 
        details: details.trim() 
      });

      setSuccess(true);
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      setErrorMsg(
        error.response?.data?.message || "Failed to submit feedback. Please try again."
      );
    } finally {
      setSubmitting(false);
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
        <span className="text-app-text-primary font-semibold text-lg animate-fade-in">Help & Feedback</span>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col pb-12">
        {success ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-4 bg-brand/10 rounded-full animate-bounce">
              <CheckCircle2 size={44} className="text-brand" />
            </div>
            <h3 className="text-base font-bold text-app-text-primary">Thank You!</h3>
            <p className="text-[11px] text-app-text-secondary max-w-[240px] leading-relaxed">
              Your feedback has been successfully submitted to the Vertex Connect team at{" "}
              <span className="text-brand font-bold">vertexconnect.team@gmail.com</span>. We will review it shortly.
            </p>
            <button
              onClick={onClose}
              className="mt-6 px-5 py-2.5 bg-brand hover:bg-brand/90 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer active:scale-95"
            >
              Back to Settings
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-2 text-brand bg-brand/10 rounded-xl">
                  <HelpCircle size={18} />
                </div>
                <div>
                  <h3 className="text-app-text-primary font-bold text-xs uppercase tracking-wider">Feedback & Support</h3>
                  <p className="text-app-text-secondary text-[10px] mt-0.5">
                    Submit your queries directly to the developer team.
                  </p>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-red-500 text-xs">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* ISSUE SUMMARY */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-wider">
                  Issue Summary / Subject
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chat scroll issue, theme request, etc."
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-app-header border border-app-border rounded-xl px-4 py-3 text-xs text-app-text-primary placeholder-app-text-secondary outline-none focus:border-brand transition"
                />
              </div>

              {/* ISSUE DETAILS */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-wider">
                  Detailed Description
                </label>
                <textarea
                  rows={5}
                  placeholder="Please describe your experience or issue in detail here..."
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-app-header border border-app-border rounded-xl px-4 py-3 text-xs text-app-text-primary placeholder-app-text-secondary outline-none focus:border-brand transition resize-none"
                />
              </div>
            </div>

            {/* ACTION BUTTON */}
            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-3.5 rounded-xl text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-99 ${
                submitting ? "bg-brand/60 cursor-not-allowed" : "bg-brand hover:bg-brand/90"
              }`}
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
                  <span>Submitting Ticket...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Submit Ticket</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default HelpFeedbackDrawer;
