import { useEffect, useRef, useState } from "preact/hooks";

export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const go = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setOnline(true);
      }, 1500);
    };
    const gone = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setOnline(false);
    };
    addEventListener("online", go);
    addEventListener("offline", gone);
    return () => {
      removeEventListener("online", go);
      removeEventListener("offline", gone);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return online;
}
