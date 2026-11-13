import React, { useState } from "react";
import { isGraphic } from "../engine/resolve";
import { api, type Issue, type Project } from "./api";
import { ApprovalLine } from "./Approval";

// What stands between the plan and an export, on one sheet: the plan's checks, QC on every graphic,
// the review and the open notes. Green on every line means go. Owain can export anyway; nothing
// else can (Claude is told not to render at all).
export type Line = { name: string; state: "ok" | "todo" | "bad"; text: string; issues?: Issue[]; action?: React.ReactNode };

export function preflight(p: Project): { lines: Line[]; ready: boolean; blocked: boolean; qcErrors: boolean } {
  const issues = p.issues ?? [];
  const errors = issues.filter((i) => i.level === "error");
  const warns = issues.filter((i) => i.level === "warn");
  const graphics = (p.resolved?.shots ?? []).filter(isGraphic).length;
  const qc = p.qc;
  const found = [...(qc?.items.flatMap((x) => x.issues) ?? []), ...(qc?.other ?? [])];
  const qcErrors = found.filter((i) => i.level === "error");
  const qcWarns = found.filter((i) => i.level === "warn");
  const review = p.review;
  const notes = (review?.review.notes ?? []).filter((n) => n.status !== "done");
  const s = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const lines: Line[] = [
    errors.length
      ? { name: "Plan", state: "bad", text: `${s(errors.length, "error")}. The export cannot start until they are fixed.`, issues: errors }
      : { name: "Plan", state: "ok", text: warns.length ? `No errors. ${s(warns.length, "warning")} to read.` : "No errors or warnings.", issues: warns },
    !graphics
      ? { name: "QC", state: "ok", text: "No graphics to check." }
      : !qc
        ? { name: "QC", state: "todo", text: "Not run yet." }
        : qc.stale.length
          ? { name: "QC", state: "todo", text: `${s(qc.stale.length, "graphic")} changed since the last run.` }
          : qcErrors.length
            ? { name: "QC", state: "bad", text: `${s(qcErrors.length, "error")} on the graphics.`, issues: found }
            : { name: "QC", state: "ok", text: qcWarns.length ? `No errors. ${s(qcWarns.length, "warning")} to read.` : `All ${s(graphics, "graphic")} pass.`, issues: qcWarns },
    !review?.items.length
      ? { name: "Review", state: "ok", text: "Nothing to review." }
      : review.counts.waiting || review.counts.change
        ? { name: "Review", state: "todo", text: `${review.counts.approved} of ${review.items.length} approved. ${review.counts.waiting} waiting, ${review.counts.change} to change.` }
        : { name: "Review", state: "ok", text: `All ${review.items.length} approved.` },
    notes.length ? { name: "Notes", state: "todo", text: `${s(notes.length, "note")} not closed.` } : { name: "Notes", state: "ok", text: "No open notes." },
  ];
  return { lines, ready: lines.every((l) => l.state === "ok"), blocked: errors.length > 0, qcErrors: !!qc && !qc.stale.length && qcErrors.length > 0 };
}

export const Preflight: React.FC<{ slug: string; p: Project; onClose: () => void; review?: boolean }> = ({ slug, p, onClose, review = true }) => {
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const { lines, ready, blocked, qcErrors } = preflight(p);
  const running = !!p.status && !p.status.done;
  const act = (run: Promise<unknown>, then?: () => void) => run.then(() => (setError(""), then?.())).catch((e) => setError(String(e.message)));
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal preflight" onClick={(e) => e.stopPropagation()}>
        <h2>Ready to export?</h2>
        <div className="lines">
          {lines.map((l) => (
            <div key={l.name} className={`line ${l.state}`}>
              <i />
              <b>{l.name}</b>
              <span>{l.text}</span>
              {!!l.issues?.length && (
                <button className="small quiet" onClick={() => setOpen(open === l.name ? null : l.name)}>
                  {open === l.name ? "Hide" : "Show"}
                </button>
              )}
              {l.name === "QC" && l.state === "todo" && (
                <button className="small" disabled={running} onClick={() => act(api.post(slug, "qc"))}>
                  {running ? p.status!.stage : "Run QC"}
                </button>
              )}
              {l.name === "Review" && l.state !== "ok" && review && (
                <a className="button small" href={`#/p/${slug}/review`}>
                  Open review
                </a>
              )}
              {open === l.name && (
                <div className="found">
                  {l.issues!.map((i, k) => (
                    <p key={k} className={`${i.level} small`}>
                      {i.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        {p.approval && <ApprovalLine slug={slug} a={p.approval} running={running} onError={setError} />}
        {error && <p className="error small">{error}</p>}
        <div className="row">
          <button onClick={onClose}>Close</button>
          <span className="spacer" />
          {running && <span className="muted small">{p.status!.stage}…</span>}
          {!ready && !blocked && (
            <button disabled={running} onClick={() => act(api.post(slug, "render", qcErrors ? { force: true } : {}), onClose)} title="Export now, with what is listed above still open">
              Export anyway
            </button>
          )}
          <button className="primary" disabled={running || !ready} onClick={() => act(api.post(slug, "render", {}), onClose)}>
            Export video
          </button>
        </div>
      </div>
    </div>
  );
};
