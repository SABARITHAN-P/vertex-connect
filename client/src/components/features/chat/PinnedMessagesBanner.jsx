import { useState } from "react";
import { Pin, ChevronLeft, ChevronRight, X } from "lucide-react";

function PinnedMessagesBanner({ pinnedMessages = [], onJumpToMessage, onUnpinMessage, isAdmin }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (pinnedMessages.length === 0) return null;

  const currentMsg = pinnedMessages[currentIndex];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % pinnedMessages.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + pinnedMessages.length) % pinnedMessages.length);
  };

  return (
    <div className="h-[50px] bg-app-header border-b border-app-border flex items-center justify-between px-4 animate-fade-in relative z-20 shadow-md">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Pin size={16} className="text-brand shrink-0 transform rotate-45" />
        
        <div
          onClick={() => onJumpToMessage(currentMsg._id)}
          className="flex-1 cursor-pointer min-w-0"
        >
          <p className="text-[10px] text-brand font-bold uppercase tracking-wider">Pinned Message #{currentIndex + 1}</p>
          <p className="text-app-text-secondary text-xs truncate max-w-md">
            {currentMsg.content || "Media Attachment"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {pinnedMessages.length > 1 && (
          <div className="flex items-center bg-app-input rounded border border-app-border overflow-hidden">
            <button onClick={handlePrev} className="p-1 hover:text-app-text-primary text-app-text-secondary border-r border-app-border transition cursor-pointer">
              <ChevronLeft size={14} />
            </button>
            <button onClick={handleNext} className="p-1 hover:text-app-text-primary text-app-text-secondary transition cursor-pointer">
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        <button
          onClick={() => onUnpinMessage(currentMsg._id)}
          className="p-1.5 hover:bg-app-hover rounded text-app-text-secondary hover:text-app-text-primary transition cursor-pointer"
          title="Unpin Message"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export default PinnedMessagesBanner;
