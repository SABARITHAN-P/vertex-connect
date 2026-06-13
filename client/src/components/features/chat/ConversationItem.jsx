import { Users } from "lucide-react";

function ConversationItem({ user, unreadCount, isMarkedUnread, onClick, isTyping, isOnline, isActive }) {
  /* =========================
     LAST MESSAGE PREVIEW
  ========================== */

  const getLastMessagePreview = () => {
    const latest = user.latestMessage;

    if (!latest) {
      return "";
    }

    const currentUserInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
    const currentUserId = currentUserInfo.id || currentUserInfo._id;

    const senderId = latest.sender?._id || latest.sender;
    const isSentByMe = senderId === currentUserId;

    let senderName = "";
    if (!isSentByMe && latest.sender?.username) {
      senderName = `${latest.sender.username}: `;
    }

    /* =========================
       MEDIA FILES
    ========================== */

    if (latest.media?.length > 0) {
      const media = latest.media;

      /* SINGLE FILE */
      if (media.length === 1) {
        const file = media[0];

        if (file.type === "gif" || latest.messageType === "gif") {
          return `${senderName}[GIF]`;
        }

        if (file.type === "sticker" || latest.messageType === "sticker") {
          return `${senderName}[Sticker]`;
        }

        if (file.mimeType?.startsWith("image") || file.type === "image") {
          return `${senderName}[Image]`;
        }

        if (file.mimeType?.startsWith("video") || file.type === "video") {
          return `${senderName}[Video]`;
        }

        if (file.mimeType?.startsWith("audio") || file.type === "audio") {
          return `${senderName}[Audio]`;
        }

        return `${senderName}[Document]`;
      }

      /* MULTIPLE FILES */
      const hasImage = media.some((f) => f.mimeType?.startsWith("image"));

      const hasVideo = media.some((f) => f.mimeType?.startsWith("video"));

      const hasAudio = media.some((f) => f.mimeType?.startsWith("audio"));

      const hasDocument = media.some(
        (f) =>
          !f.mimeType?.startsWith("image") &&
          !f.mimeType?.startsWith("video") &&
          !f.mimeType?.startsWith("audio"),
      );

      if (hasImage && !hasVideo && !hasAudio && !hasDocument) {
        return `${senderName}[Images: ${media.length}]`;
      }

      if (hasVideo && !hasImage && !hasAudio && !hasDocument) {
        return `${senderName}[Videos: ${media.length}]`;
      }

      if (hasAudio && !hasImage && !hasVideo && !hasDocument) {
        return `${senderName}[Audio files: ${media.length}]`;
      }

      if (hasDocument && !hasImage && !hasVideo && !hasAudio) {
        return `${senderName}[Documents: ${media.length}]`;
      }

      return `${senderName}[Files: ${media.length}]`;
    }

    /* =========================
       POLLS
    ========================== */
    if (latest.messageType === "poll") {
      return `${senderName}[Poll] ${latest.poll?.question || ""}`;
    }

    /* =========================
       TEXT MESSAGE
    ========================== */

    if (latest.content?.trim()) {
      return `${senderName}${latest.content}`;
    }

    if (latest.caption?.trim()) {
      return `${senderName}${latest.caption}`;
    }

    return "";
  };

  return (
    <div
      onClick={onClick}
      className={`
        chat-item-card
        flex
        items-center
        justify-between
        px-4
        py-3
        cursor-pointer
        transition-colors
        duration-150
        border-b
        border-app-border/30
        ${isActive ? "bg-app-active" : "hover:bg-app-hover/65 bg-transparent"}
      `}
    >
      {/* LEFT */}
      <div className="flex items-center flex-1 min-w-0">
        {/* AVATAR */}
        <div 
          className="relative shrink-0 cursor-pointer hover:opacity-85 transition-opacity"
          onClick={(e) => {
            if (user && !user.isGroupChat) {
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent("view-user-profile", { detail: user }));
            }
          }}
        >
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.username}
              className="w-12 h-12 rounded-full object-cover shrink-0 border border-app-border/50"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-brand/10 dark:bg-brand/25 flex items-center justify-center text-brand dark:text-white font-semibold text-lg shrink-0 border border-app-border/40">
              {user.isGroupChat ? <Users size={20} className="text-brand dark:text-white" /> : user.username[0].toUpperCase()}
            </div>
          )}
        </div>

        {/* USER INFO */}
        <div className="ml-3 flex-1 min-w-0">
          <h2 className="text-app-text-primary font-medium truncate">{user.username}</h2>

          {/* MESSAGE PREVIEW */}
          {isTyping ? (
            <div className="flex items-center gap-1.5 text-brand text-xs font-semibold italic animate-pulse">
              {isTyping.avatar && user.isGroupChat ? (
                <img
                  src={isTyping.avatar}
                  alt="Typing avatar"
                  className="w-4 h-4 rounded-full object-cover shrink-0 border border-brand/20 shadow"
                />
              ) : isTyping.username && user.isGroupChat ? (
                <div className="w-4 h-4 rounded-full bg-brand/10 dark:bg-brand/25 flex items-center justify-center text-[8px] text-brand dark:text-white font-bold shrink-0 border border-brand/20 shadow">
                  {isTyping.username[0].toUpperCase()}
                </div>
              ) : null}
              <span>
                {user.isGroupChat
                  ? `${isTyping.username || "Someone"} is typing...`
                  : "typing..."}
              </span>
            </div>
          ) : (
            <p className="text-app-text-secondary text-sm truncate">
              {getLastMessagePreview()}
            </p>
          )}
        </div>
      </div>

      {/* UNREAD COUNT OR MANUAL UNREAD DOT */}
      {unreadCount > 0 ? (
        <div
          className="
            ml-3
            min-w-[22px]
            h-[22px]
            px-1.5
            rounded-full
            bg-brand
            flex
            items-center
            justify-center
            text-[11px]
            text-white
            font-bold
            shadow-sm
          "
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </div>
      ) : isMarkedUnread ? (
        <div
          className="
            ml-3
            w-3
            h-3
            rounded-full
            bg-brand
            shadow-sm
            animate-pulse
          "
          title="Marked as unread"
        />
      ) : null}
    </div>
  );
}

export default ConversationItem;
