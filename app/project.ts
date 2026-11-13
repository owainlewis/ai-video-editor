import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ChatMessage, type Project } from "./api";

// One project, kept up to date: loaded on mount and again whenever the server says its plan or its
// status changed. The words are large and change only with the cut, so a reload leaves them out
// unless they did.
export function useProject(slug: string) {
  const [p, setP] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [working, setWorking] = useState(false);
  const key = useRef<string | undefined>(undefined);

  const load = useCallback(
    () =>
      api.project(slug, key.current).then((d) => {
        key.current = d.wordsKey;
        setP((old) => ({ ...d, words: d.words ?? old?.words, clipWords: d.clipWords ?? old?.clipWords }));
        setChat(d.chat ?? []);
        setWorking(!!d.working);
        setError("");
      }).catch((e) => setError(String(e.message))),
    [slug],
  );
  useEffect(() => {
    load();
    return api.events((e) => {
      if (e.slug !== slug) return;
      if (e.type === "plan" || e.type === "status") load();
      if (e.type === "chat") {
        const m = e.message;
        if (m.role === "status") setWorking(m.text === "working");
        else setChat((c) => [...c, m]);
      }
    });
  }, [slug, load]);

  return { p, error, setError, chat, working };
}
