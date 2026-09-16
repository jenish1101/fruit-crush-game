import { StrictMode, useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App";
import Splash from "./Splash";

registerSW({ immediate: true });

function Root() {
  const [ready, setReady] = useState(false);
  const onSplashDone = useCallback(() => setReady(true), []);

  return (
    <>
      <div
        className={ready ? undefined : "invisible pointer-events-none"}
        aria-hidden={!ready}
      >
        <App />
      </div>
      {!ready && <Splash onDone={onSplashDone} />}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
