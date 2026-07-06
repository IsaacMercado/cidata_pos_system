import { useEffect, useState } from "preact/hooks";

export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const go = () => setOnline(true);
    const gone = () => setOnline(false);
    addEventListener("online", go);
    addEventListener("offline", gone);
    return () => {
      removeEventListener("online", go);
      removeEventListener("offline", gone);
    };
  }, []);

  return online;
}
