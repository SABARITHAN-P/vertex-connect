import { useEffect, useRef } from "react";
import { backButtonManager } from "@utils/backButtonManager";

export function useBackButton(callback, active = true, id) {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!active) {
      backButtonManager.unregister(id);
      return;
    }

    const handleBack = () => {
      if (callbackRef.current) {
        callbackRef.current();
      }
    };

    backButtonManager.register(id, handleBack);

    return () => {
      backButtonManager.unregister(id);
    };
  }, [active, id]);
}
