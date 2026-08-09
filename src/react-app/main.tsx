import { render } from "preact";
import { App } from "./App";

if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) registration.unregister();
  });
  if ("caches" in window) {
    caches.keys().then((keys) => {
      for (const key of keys) void caches.delete(key);
    });
  }
}

const root = document.getElementById("app");
if (root) render(<App />, root);
