import React, { useState } from "react";
import { api, type Approval, type ApprovalState } from "./api";
import { confirmIt } from "./dialog";

// A finished reel's approval (media/approve.ts): Draft until its final export is current and passed
// its check, then Exported (ready to approve), then Approved once its export and cover are in the
// approved folder, and Out of date if the plan changes after that.

export const LABEL: Record<ApprovalState, string> = { draft: "Draft", exported: "Exported", approved: "Approved", stale: "Out of date" };

export const shortDate = (at: string) => new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short" });

// What each state means, in a sentence, for a title or a line on the export sheet.
export function explain(a: Approval): string {
  const r = a.record;
  if (a.state === "approved" && r) return `Approved ${shortDate(r.at)}: in ${a.where ?? a.folder}.`;
  if (a.state === "stale" && r) return `Approved ${shortDate(r.at)}, but ${a.reason}. ${a.ready ? "The new export is ready to approve again." : "Export again, then approve it again."}`;
  if (a.state === "exported") return `The export is current and its check passed. Approving puts it, its image and its caption in one folder in ${a.folder}.`;
  return `Not ready to approve: ${a.reason}.`;
}

// The pill by the title: the state, and the date once approved.
export const ApprovalBadge: React.FC<{ a: Approval }> = ({ a }) => (
  <span className={`approval ${a.state}`} title={explain(a)}>
    {a.state === "approved" && a.record ? `Approved ${shortDate(a.record.at)}` : LABEL[a.state]}
  </span>
);

// Approve, unapprove and show in Finder, with what is happening and what went wrong.
export function useApproval(slug: string, onError: (message: string) => void) {
  const [busy, setBusy] = useState<"" | "approve" | "unapprove">("");
  const act = (which: "approve" | "unapprove", run: () => Promise<unknown>) => {
    setBusy(which);
    return run()
      .catch((e) => onError(String(e.message)))
      .finally(() => setBusy(""));
  };
  return {
    busy,
    approve: () => act("approve", () => api.post(slug, "approve")),
    unapprove: () =>
      confirmIt({ title: "Unapprove this reel?", body: "Its folder (video, image and caption) moves to the Trash.", ok: "Unapprove" }).then((yes) =>
        yes ? act("unapprove", () => api.post(slug, "unapprove")) : undefined,
      ),
    reveal: () => api.post(slug, "reveal").catch((e) => onError(String(e.message))),
  };
}

// The approval line on the export sheet: the state, what it means, and what can be done.
export const ApprovalLine: React.FC<{ slug: string; a: Approval; running: boolean; onError: (message: string) => void }> = ({ slug, a, running, onError }) => {
  const { busy, approve, unapprove, reveal } = useApproval(slug, onError);
  const dot = a.state === "approved" || a.state === "exported" ? "ok" : "todo";
  return (
    <div className="lines">
      <div className={`line ${dot}`}>
        <i />
        <b>Approval</b>
        <span>
          {explain(a)}
          {a.record && !a.reveal && <code className="path">{a.record.video}</code>}
        </span>
        {a.record && a.reveal && (
          <button className="small quiet" onClick={reveal} title={a.record.video}>
            Show in Finder
          </button>
        )}
        {a.record && (
          <button className="small quiet" disabled={!!busy} onClick={unapprove} title="Move its folder to the Trash">
            {busy === "unapprove" ? "Unapproving…" : "Unapprove"}
          </button>
        )}
        {a.ready && a.state !== "approved" && (
          <button className="small" disabled={!!busy || running} onClick={approve}>
            {busy === "approve" ? "Approving…" : a.state === "stale" ? "Approve again" : "Approve"}
          </button>
        )}
      </div>
    </div>
  );
};
