import { Image, FileText, Music, X, BarChart2 } from "lucide-react";

function AttachmentMenu({
  onImageVideoClick,
  onDocumentClick,
  onAudioClick,
  onPollClick,
  showPoll,
  closeMenu,
}) {
  return (
    <div
      className="
        absolute
        bottom-16
        left-14
        bg-app-modal
        rounded-2xl
        shadow-2xl
        p-3
        z-50
        w-56
        border border-app-border
      "
    >
      {/* HEADER */}
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-app-text-primary text-sm font-semibold">Attachments</p>

        <button onClick={closeMenu} className="text-app-text-secondary hover:text-app-text-primary transition cursor-pointer">
          <X size={18} />
        </button>
      </div>

      {/* OPTIONS */}
      <div className="flex flex-col gap-1.5">
        {/* PHOTOS & VIDEOS */}
        <button
          onClick={onImageVideoClick}
          className="
            flex
            items-center
            gap-3
            p-2.5
            rounded-xl
            hover:bg-app-hover
            transition
            text-app-text-primary
            cursor-pointer
            text-left
          "
        >
          <div className="bg-pink-500 p-2 rounded-full text-white shrink-0">
            <Image size={16} />
          </div>

          <span className="text-xs font-medium">Photos & Videos</span>
        </button>

        {/* DOCUMENT */}
        <button
          onClick={onDocumentClick}
          className="
            flex
            items-center
            gap-3
            p-2.5
            rounded-xl
            hover:bg-app-hover
            transition
            text-app-text-primary
            cursor-pointer
            text-left
          "
        >
          <div className="bg-blue-500 p-2 rounded-full text-white shrink-0">
            <FileText size={16} />
          </div>

          <span className="text-xs font-medium">Document</span>
        </button>

        {/* AUDIO */}
        <button
          onClick={onAudioClick}
          className="
            flex
            items-center
            gap-3
            p-2.5
            rounded-xl
            hover:bg-app-hover
            transition
            text-app-text-primary
            cursor-pointer
            text-left
          "
        >
          <div className="bg-amber-500 p-2 rounded-full text-white shrink-0">
            <Music size={16} />
          </div>

          <span className="text-xs font-medium">Audio</span>
        </button>

        {/* POLL (ONLY FOR GROUPS) */}
        {showPoll && (
          <button
            onClick={onPollClick}
            className="
              flex
              items-center
              gap-3
              p-2.5
              rounded-xl
              hover:bg-app-hover
              transition
              text-app-text-primary
              cursor-pointer
              text-left
            "
          >
            <div className="bg-brand p-2 rounded-full text-white shrink-0">
              <BarChart2 size={16} />
            </div>

            <span className="text-xs font-medium">Poll</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default AttachmentMenu;
