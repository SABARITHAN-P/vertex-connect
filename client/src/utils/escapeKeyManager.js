let counter = 0;

class EscapeKeyManager {
  constructor() {
    this.stack = [];
    if (typeof window !== "undefined") {
      this.handleKeyDown = this.handleKeyDown.bind(this);
      window.addEventListener("keydown", this.handleKeyDown, true); // Capture phase to catch it first
    }
  }

  register(id, callback, priority = 0) {
    // Prevent duplicate registration of the same ID
    this.stack = this.stack.filter((item) => item.id !== id);
    counter += 1;
    this.stack.push({ id, callback, priority, index: counter });

    // Sort: highest priority first. If priorities are equal, latest registered index first (LIFO).
    this.stack.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return b.index - a.index;
    });
  }

  unregister(id) {
    this.stack = this.stack.filter((item) => item.id !== id);
  }

  handleKeyDown(event) {
    if (event.key === "Escape") {
      if (this.stack.length > 0) {
        const topmost = this.stack[0];
        if (topmost && typeof topmost.callback === "function") {
          event.preventDefault();
          event.stopPropagation();
          topmost.callback(event);
        }
      }
    }
  }
}

export const escapeKeyManager = new EscapeKeyManager();
