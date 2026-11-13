import React, { useState, useSyncExternalStore } from "react";

// The app's own dialogs, in place of the browser's prompt and confirm boxes. Called like them, but
// they answer with a promise: `ask` gives the text typed (null if cancelled), `confirmIt` gives true
// or false. One shows at a time; `<Dialogs />` is mounted once, in main.tsx, and draws it.
// Enter takes the answer, Escape or a click outside cancels.

type Request = {
  title: string;
  body?: string;
  // The button that goes ahead, named for what it does ("Delete", "Rename").
  ok: string;
  // Going ahead cannot be taken back with undo.
  danger?: boolean;
  // With `input`, the dialog asks for a line of text.
  input?: { value?: string; placeholder?: string; optional?: boolean };
  done: (answer: string | null) => void;
};

let open: Request | null = null;
const subs = new Set<() => void>();
const set = (r: Request | null) => {
  // A dialog asked for while another is up cancels the first.
  if (r && open) open.done(null);
  open = r;
  for (const f of subs) f();
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};

export const ask = (q: { title: string; body?: string; ok?: string; value?: string; placeholder?: string; optional?: boolean }): Promise<string | null> =>
  new Promise((done) => set({ title: q.title, body: q.body, ok: q.ok ?? "Save", input: { value: q.value, placeholder: q.placeholder, optional: q.optional }, done }));

export const confirmIt = (q: { title: string; body?: string; ok: string; danger?: boolean }): Promise<boolean> =>
  new Promise((done) => set({ ...q, done: (answer) => done(answer !== null) }));

export const Dialogs: React.FC = () => {
  const r = useSyncExternalStore(subscribe, () => open);
  return r ? <Dialog key={r.title + (r.input?.value ?? "")} r={r} /> : null;
};

const Dialog: React.FC<{ r: Request }> = ({ r }) => {
  const [text, setText] = useState(r.input?.value ?? "");
  const answer = (a: string | null) => {
    r.done(a);
    if (open === r) set(null);
  };
  const ready = !r.input || r.input.optional || !!text.trim();
  const go = () => ready && answer(r.input ? text.trim() : "");
  return (
    <div
      className="modal-back"
      onClick={(e) => e.target === e.currentTarget && answer(null)}
      // The page's own keys (Delete, B, J K L) must not act on what is behind the dialog.
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") answer(null);
        else if (e.key === "Enter" && r.input) (e.preventDefault(), go());
      }}
    >
      <div className="modal dialog" role="dialog" aria-modal="true" aria-label={r.title}>
        <h2>{r.title}</h2>
        {r.body && <p className="body">{r.body}</p>}
        {r.input && <input autoFocus value={text} placeholder={r.input.placeholder} onChange={(e) => setText(e.target.value)} onFocus={(e) => e.target.select()} />}
        <div className="row">
          <span className="spacer" />
          {/* Enter lands on Cancel when going ahead cannot be undone. */}
          <button autoFocus={!r.input && !!r.danger} onClick={() => answer(null)}>Cancel</button>
          <button className={r.danger ? "danger" : "primary"} autoFocus={!r.input && !r.danger} disabled={!ready} onClick={go}>
            {r.ok}
          </button>
        </div>
      </div>
    </div>
  );
};
