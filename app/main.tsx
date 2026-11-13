import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Dialogs } from "./dialog";
import { Editor } from "./Editor";
import { Gallery } from "./Gallery";
import { Home } from "./Home";
import { Review } from "./Review";

// Pages, by hash: #/ lists projects, #/p/<slug> opens one in the editor, #/p/<slug>/review reviews it
// before rendering, #/gallery plays every graphic.
const route = () => (location.hash.startsWith("#/gallery") ? "gallery" : location.hash.match(/^#\/p\/([^/?#]+)/)?.[1]);

const App: React.FC = () => {
  const [slug, setSlug] = useState(route);
  // The page can change while the project stays the same (the editor and its review).
  const [, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => (setSlug(route()), setHash(location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  if (slug === "gallery") return <Gallery />;
  if (slug && /^#\/p\/[^/?#]+\/review/.test(location.hash)) return <Review key={slug} slug={decodeURIComponent(slug)} />;
  return slug ? <Editor key={slug} slug={decodeURIComponent(slug)} /> : <Home />;
};

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Dialogs />
  </>,
);
