// Team model shared by the dashboard and its server (DEC-15, build step 2).
// Content files: members.json, workspace.json, activity/<member>.jsonl at the content root,
// and projects/<slug>/team.json + review.json. Local only: .studio/me.json (which member this machine is).

export type Role = "admin" | "publisher" | "editor" | "reviewer";
export type Member = { id: string; name: string; roles: Role[] };
export type Members = { members: Member[] };

// Where a video went out. Instagram entries are written by the server after a real post;
// a YouTube entry without an id is the "Mark as uploaded" button.
export type PublishedEntry = { id?: string; url?: string; at: string; by?: string };
export type Team = {
  owner?: string; // member id; edits the script and approves it (Q6)
  assignees?: Record<string, string>; // e.g. { visuals: "m2" }
  lock?: { by: string; at: string; scope: "script" } | null; // check-out, used by sync (step 3)
  published?: { youtube?: PublishedEntry; instagram?: PublishedEntry };
};

// Folders and which folder each project is in. One key per project, so merges are clean.
export type Workspace = { folders: { id: string; name: string }[]; projects: Record<string, { folder?: string }> };

export type ActivityType =
  | "review.approved" | "review.changes" | "review.cleared"
  | "script.approved" | "script.revoked"
  | "team.owner" | "published.marked" | "published.unmarked" | "instagram.posted"
  | "voice.generated" | "export.done" | "project.moved"
  | "edit.checkout" | "edit.release";
export type Activity = { at: string; by: string; project?: string; type: ActivityType; scene?: string; note?: string };

export const ACTIVITY_TEXT: Record<ActivityType, string> = {
  "review.approved": "approved a scene",
  "review.changes": "requested a change",
  "review.cleared": "cleared a review",
  "script.approved": "approved the script",
  "script.revoked": "revoked the script approval",
  "team.owner": "changed the owner",
  "published.marked": "marked it uploaded",
  "published.unmarked": "unmarked it uploaded",
  "instagram.posted": "posted it to Instagram",
  "voice.generated": "generated voice",
  "export.done": "exported the video",
  "project.moved": "moved it to a folder",
  "edit.checkout": "started editing",
  "edit.release": "finished editing",
};

export const hasRole = (m: Member | null | undefined, role: Role) => !!m && (m.roles.includes(role) || m.roles.includes("admin"));

// The owner approves the script; a video with no owner can be approved by an admin.
export const canApproveScript = (me: Member | null, team: Team) =>
  !!me && (team.owner ? team.owner === me.id : me.roles.includes("admin"));

export const uploadedAt = (team: Team) =>
  [team.published?.youtube?.at, team.published?.instagram?.at].filter(Boolean).sort()[0] ?? null;
