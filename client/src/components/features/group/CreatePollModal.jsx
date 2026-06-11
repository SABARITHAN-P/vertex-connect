import { useState } from "react";
import { X, Plus, Trash, AlertCircle } from "lucide-react";
import { useEscapeKey } from "@hooks/useEscapeKey";

function CreatePollModal({ onClose, onSend }) {
  // Close modal on ESC key
  useEscapeKey(onClose, true, 10);

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [showVoters, setShowVoters] = useState(true);
  const [error, setError] = useState("");

  const handleAddOption = () => {
    if (options.length >= 10) return;
    setOptions([...options, ""]);
  };

  const handleRemoveOption = (index) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index, value) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const handleSubmit = () => {
    if (!question.trim()) {
      setError("Question is required");
      return;
    }

    const filledOptions = options.map((o) => o.trim()).filter(Boolean);
    if (filledOptions.length < 2) {
      setError("Provide at least 2 choice options");
      return;
    }

    const formattedOptions = filledOptions.map((o) => ({
      optionText: o,
      votes: [],
    }));

    onSend({
      question: question.trim(),
      options: formattedOptions,
      showVoters,
    });
    onClose();
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleSubmit();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <form
        onSubmit={handleFormSubmit}
        className="bg-app-modal text-app-text-primary w-full max-w-md rounded-2xl border border-app-border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-fade-in"
      >
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-app-border flex justify-between items-center bg-app-header">
          <h2 className="text-lg font-semibold tracking-wide">Create Poll</h2>
          <button type="button" onClick={onClose} className="text-app-text-secondary hover:text-app-text-primary transition cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="text-xs text-app-text-secondary uppercase font-bold tracking-wider">Question</label>
            <input
              type="text"
              placeholder="Ask a question..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full mt-1 bg-app-input border border-app-border focus:border-brand rounded-lg px-3.5 py-2.5 text-sm text-app-text-primary outline-none transition"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-app-text-secondary uppercase font-bold tracking-wider">Options</label>
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Option ${index + 1}`}
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  className="flex-1 bg-app-input border border-app-border focus:border-brand rounded-lg px-3.5 py-2 text-sm text-app-text-primary outline-none transition"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(index)}
                    className="p-2 text-app-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                  >
                    <Trash size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {options.length < 10 && (
            <button
              type="button"
              onClick={handleAddOption}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-app-border hover:border-brand hover:text-brand text-app-text-secondary text-sm font-semibold transition cursor-pointer"
            >
              <Plus size={16} />
              <span>Add Option</span>
            </button>
          )}

          <div className="flex items-center justify-between p-3.5 bg-app-input/40 rounded-xl border border-app-border mt-4">
            <div className="flex flex-col pr-3">
              <span className="text-xs font-semibold text-app-text-primary">Show voters' names</span>
              <span className="text-[10px] text-app-text-secondary mt-0.5 leading-relaxed">Allow everyone in the group to see who voted for each option</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
              <input
                type="checkbox"
                checked={showVoters}
                onChange={(e) => setShowVoters(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-600 rounded-full peer peer-focus:outline-none peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand"></div>
            </label>
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-5 py-4 border-t border-app-border flex justify-end gap-3 bg-app-header">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-app-text-secondary hover:text-app-text-primary transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-brand hover:opacity-90 text-white px-5 py-2 text-sm font-semibold rounded-lg transition shadow-md cursor-pointer"
          >
            Send Poll
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreatePollModal;
