import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Editor } from "./Editor";
import { Home } from "./Home";

// Pages, by hash: #/ lists projects, #/p/<slug> opens one in the editor.
const route = () => location.hash.match(/^#\/p\/([^/?#]+)/)?.[1];

const App: React.FC = () => {
  const [slug, setSlug] = useState(route);
  useEffect(() => {
    const on = () => setSlug(route());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return slug ? <Editor key={slug} slug={decodeURIComponent(slug)} /> : <Home />;
};

createRoot(document.getElementById("root")!).render(<App />);
