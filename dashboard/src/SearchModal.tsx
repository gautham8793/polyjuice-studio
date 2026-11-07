import { useEffect, useState } from "react";
import { api, type SearchResult } from "./api";

type Props = {
  initialQuery: string;
  sceneLabel: string;
  onPick: (result: SearchResult) => Promise<void>;
  onClose: () => void;
};

type Provider = "wikimedia" | "pexels";

export const SearchModal: React.FC<Props> = ({ initialQuery, sceneLabel, onPick, onClose }) => {
  const [provider, setProvider] = useState<Provider>("wikimedia");
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "no-key">("idle");
  const [error, setError] = useState("");
  const [picking, setPicking] = useState<string | null>(null);

  const search = async (p = provider, q = query) => {
    if (!q.trim()) return;
    setStatus("loading");
    try {
      setResults(await api.search(p, q));
      setStatus("idle");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg === "no-pexels-key" ? "no-key" : "error");
      setError(msg);
      setResults([]);
    }
  };

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pick = async (r: SearchResult) => {
    setPicking(r.id);
    try {
      await onPick(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
      setPicking(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Find an image">
        <header className="modal-head">
          <div>
            <h2>Find an image</h2>
            <p className="muted">for {sceneLabel}</p>
          </div>
          <button className="btn ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="search-bar">
          <div className="tabs" role="tablist">
            {(["wikimedia", "pexels"] as Provider[]).map((p) => (
              <button
                key={p}
                role="tab"
                aria-selected={provider === p}
                className={`tab ${provider === p ? "active" : ""}`}
                onClick={() => setProvider(p)}
              >
                {p === "wikimedia" ? "Wikimedia Commons" : "Pexels"}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              search();
            }}
          >
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" autoFocus />
            <button className="btn primary" type="submit">Search</button>
          </form>
        </div>

        <div className="results">
          {status === "loading" && <p className="muted">Searching…</p>}
          {status === "no-key" && (
            <div className="notice">
              <strong>Pexels needs a free API key.</strong> Get one at pexels.com/api, then add
              <code>PEXELS_API_KEY=your-key</code> to <code>dashboard/.env.local</code> and restart the dashboard.
            </div>
          )}
          {status === "error" && <div className="notice error">{error}</div>}
          {status === "idle" && results.length === 0 && <p className="muted">No results. Try a simpler query.</p>}
          <div className="grid">
            {results.map((r) => (
              <button key={r.id} className="result" onClick={() => pick(r)} disabled={!!picking} title={r.title}>
                <img src={r.thumb} alt={r.title} loading="lazy" />
                <span className="result-meta">
                  <span className="license">{r.license}</span>
                  <span className="credit">{r.credit}</span>
                </span>
                {picking === r.id && <span className="result-busy">Saving…</span>}
              </button>
            ))}
          </div>
        </div>
        <footer className="modal-foot muted">
          License and credit are saved with the image. Check the source page before publishing — some licenses need attribution.
        </footer>
      </div>
    </div>
  );
};
