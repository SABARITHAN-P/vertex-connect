import { useEffect, useRef } from "react";
import { escapeKeyManager } from "@utils/escapeKeyManager";

export function useEscapeKey(callback, active = true, priority = 0, id = null) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // Generate a stable unique ID if not provided
  const uniqueIdRef = useRef(id || Math.random().toString(36).substring(2, 9));

  useEffect(() => {
    if (!active) {
      escapeKeyManager.unregister(uniqueIdRef.current);
      return;
    }

    const handleEscape = (event) => {
      if (callbackRef.current) {
        callbackRef.current(event);
      }
    };

    escapeKeyManager.register(uniqueIdRef.current, handleEscape, priority);

    return () => {
      escapeKeyManager.unregister(uniqueIdRef.current);
    };
  }, [active, priority]);
}
