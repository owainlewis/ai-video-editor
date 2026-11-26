import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ChatMessage, type Project } from "./api";

// Keep `resolved` and `cut` object identities stable when a reload (e.g. a background `status` SSE
// event) brings back the exact same plan and cut, so Inspector drafts, Timeline trims and
// SoundPick's retry guard are not wiped by unrelated status updates.
export function mergeProject(old: Project | null, next: Project): Project {
  const sameResolved =
    old?.resolved !== undefined &&
    next.resolved !== undefined &&
    JSON.stringify(old.resolved) === JSON.stringify(next.resolved);
  const sameCut =
    old?.cut !== undefined &&
    next.cut !== undefined &&
    JSON.stringify(old.cut) === JSON.stringify(next.cut);
  return {
    ...next,
    resolved: sameResolved ? old!.resolved : next.resolved,
    cut: sameCut ? old!.cut : next.cut,
    words: next.words ?? old?.words,
    clipWords: next.clipWords ?? old?.clipWords,
  };
}

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
        setP((old) => mergeProject(old, d));
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
