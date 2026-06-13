import { useEffect, useRef, useId } from "react";
import { escapeKeyManager } from "@utils/escapeKeyManager";

export function useEscapeKey(callback, active = true, priority = 0, id = null) {
  const reactId = useId();
  const uniqueId = id || reactId;

  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!active) {
      escapeKeyManager.unregister(uniqueId);
      return;
    }

    const handleEscape = (event) => {
      if (callbackRef.current) {
        callbackRef.current(event);
      }
    };

    escapeKeyManager.register(uniqueId, handleEscape, priority);

    return () => {
      escapeKeyManager.unregister(uniqueId);
    };
  }, [active, priority, uniqueId]);
}
