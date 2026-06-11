import { useTheme } from "@context/ThemeContext";
import EmojiPicker, { Theme, EmojiStyle } from "emoji-picker-react";

function MediaPanel({ onEmojiSelect, onClose }) {
  const { theme } = useTheme();
  const pickerTheme = theme === "light" ? Theme.LIGHT : Theme.DARK;

  return (
    <div className="relative h-[380px] w-[320px] md:w-[360px] rounded-2xl overflow-hidden animate-fade-in select-none emoji-picker-wrapper">
      <style dangerouslySetInnerHTML={{ __html: `
        .emoji-picker-wrapper .EmojiPickerReact {
          --epr-bg-color: var(--bg-modal, #17212b) !important;
          --epr-category-navigation-button-active-color: var(--brand-color, #0f766e) !important;
          --epr-active-category-indicator-color: var(--brand-color, #0f766e) !important;
          --epr-search-input-bg-color: var(--bg-input, #101921) !important;
          --epr-search-input-border-color: var(--border-color, #101921) !important;
          --epr-search-input-focus-border-color: var(--brand-color, #0f766e) !important;
          --epr-search-input-placeholder-color: var(--text-secondary, #7f91a4) !important;
          --epr-text-color: var(--text-primary, #f5f6f7) !important;
          --epr-category-label-bg-color: var(--bg-modal, #17212b) !important;
          --epr-category-label-text-color: var(--text-secondary, #7f91a4) !important;
          --epr-hover-bg-color: var(--bg-hover, #202b36) !important;
          --epr-focus-bg-color: var(--bg-hover, #202b36) !important;
          --epr-picker-border-radius: 16px !important;
          
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08)) !important;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25) !important;
          width: 100% !important;
          height: 100% !important;
        }

        /* Customize scrollbars for perfect styling inside picker body */
        .emoji-picker-wrapper .EmojiPickerReact .epr-body::-webkit-scrollbar {
          width: 4px !important;
        }
        .emoji-picker-wrapper .EmojiPickerReact .epr-body::-webkit-scrollbar-thumb {
          background-color: var(--border-color, rgba(255, 255, 255, 0.15)) !important;
          border-radius: 10px !important;
        }

        /* Search input styling */
        .emoji-picker-wrapper .EmojiPickerReact .epr-search-container input {
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1)) !important;
          border-radius: 10px !important;
          font-family: inherit !important;
          font-size: 13px !important;
          height: 38px !important;
          transition: all 0.2s ease-in-out !important;
        }

        .emoji-picker-wrapper .EmojiPickerReact .epr-search-container input:focus {
          border-color: var(--brand-color, #0f766e) !important;
          box-shadow: 0 0 0 1px var(--brand-color, #0f766e) !important;
          outline: none !important;
        }

        /* Category Label Headings */
        .emoji-picker-wrapper .EmojiPickerReact .epr-emoji-category-label {
          background-color: var(--bg-modal, #17212b) !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          color: var(--text-secondary, #7f91a4) !important;
        }

        /* Category tab buttons navigation height adjustments */
        .emoji-picker-wrapper .EmojiPickerReact .epr-category-nav {
          padding: 8px 10px 4px 10px !important;
        }
      `}} />

      <EmojiPicker
        theme={pickerTheme}
        emojiStyle={EmojiStyle.APPLE}
        onEmojiClick={(emojiData) => onEmojiSelect(emojiData.emoji)}
        width="100%"
        height="100%"
        lazyLoadEmojis={true}
        skinTonesDisabled={true}
        searchPlaceHolder="Search emoji"
        previewConfig={{ showPreview: false }}
      />
    </div>
  );
}

export default MediaPanel;
