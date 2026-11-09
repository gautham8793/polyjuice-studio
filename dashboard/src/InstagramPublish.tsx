import type { RenderJob } from "./api";

type Props = { slug: string; render: RenderJob; onPublished: () => void };

// Posting to Instagram moved to the Publish card at the top of this tab, together with YouTube,
// behind one checklist and one confirm (DEC-15 step 4).
export const InstagramPublish: React.FC<Props> = () => (
  <p className="muted small">Post to Instagram (and YouTube) from the Publish card at the top of this tab.</p>
);
