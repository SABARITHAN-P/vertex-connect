class BackButtonManager {
  constructor() {
    this.stack = [];
    this.isPoppingState = false;
    if (typeof window !== "undefined") {
      this.handlePopState = this.handlePopState.bind(this);
      window.addEventListener("popstate", this.handlePopState);
    }
  }

  register(id, callback) {
    // Prevent duplicate registration for the same ID
    this.stack = this.stack.filter((item) => item.id !== id);
    
    // Register callback
    this.stack.push({ id, callback });

    // Push dummy history entry to intercept back navigation
    window.history.pushState({ backHandlerId: id }, "");
  }

  unregister(id) {
    const wasRegistered = this.stack.some((item) => item.id === id);
    if (!wasRegistered) return;

    this.stack = this.stack.filter((item) => item.id !== id);

    // If not in popstate event, manually pop the history entry
    if (!this.isPoppingState) {
      window.history.back();
    }
  }

  handlePopState() {
    if (this.stack.length > 0) {
      this.isPoppingState = true;
      try {
        const topmost = this.stack.pop();
        if (topmost && typeof topmost.callback === "function") {
          topmost.callback();
        }
      } finally {
        this.isPoppingState = false;
      }
    }
  }
}

export const backButtonManager = new BackButtonManager();
