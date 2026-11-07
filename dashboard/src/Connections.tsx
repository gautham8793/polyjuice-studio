import { useEffect, useState } from "react";
import { api, type InstagramStatus } from "./api";

const PERMISSIONS = "instagram_basic, instagram_content_publish, pages_show_list, pages_read_engagement, business_management";

// Accounts the dashboard can publish to. Credentials go to the local server once and stay in secrets/.
export const Connections: React.FC = () => {
  const [ig, setIg] = useState<InstagramStatus | null>(null);
  const [form, setForm] = useState(false);
  const [userToken, setUserToken] = useState("");
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<string | null>(null);

  useEffect(() => {
    api.instagramStatus().then(setIg, (e) => setError(String(e.message ?? e)));
  }, []);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      setIg(await api.connectInstagram({ userToken, appId, appSecret }));
      setForm(false);
      setUserToken("");
      setAppSecret("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // Runs the whole upload on the newest export but stops before publishing; the draft expires unseen.
  const testUpload = async () => {
    setTest("Uploading a test draft…");
    try {
      const r = await api.testInstagramUpload();
      setTest(`Upload works ✓ Instagram processed ${r.video} as a draft. Nothing was posted.`);
    } catch (e) {
      setTest(`Test failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const disconnect = async () => {
    if (!confirm("Disconnect Instagram? The saved token is deleted from this Mac.")) return;
    setIg(await api.disconnectInstagram());
  };

  const showForm = form || ig?.connected === false;

  return (
    <div className="sound-group span-all">
      <h3>Connections · all videos</h3>
      <div className="connection">
        <div className="connection-head">
          {ig?.connected && ig.profilePicture ? <img className="avatar" src={ig.profilePicture} alt="" /> : <span className="avatar">📸</span>}
          <div className="connection-info">
            <strong>Instagram</strong>
            {ig === null && <span className="muted small">Checking…</span>}
            {ig?.connected === false && <span className="muted small">Not connected</span>}
            {ig?.connected && (
              <span className="small">
                <span className={ig.ok ? "ok-text" : "warn-text"}>{ig.ok ? "Connected ✓" : "Needs reconnecting"}</span>
                {" "}as <strong>@{ig.username}</strong> <span className="muted">via the Facebook Page “{ig.pageName}”</span>
              </span>
            )}
            {ig?.connected && ig.ok && (
              <span className="muted small">
                {ig.followers !== undefined && `${ig.followers.toLocaleString()} followers · `}
                {ig.posts !== undefined && `${ig.posts} posts · `}
                {ig.quota && `${ig.quota.used}/${ig.quota.total} API posts in the last 24 h · `}
                {ig.uploadTokenExpiresAt ? `token valid until ${new Date(ig.uploadTokenExpiresAt).toLocaleDateString()} (renews automatically)` : ig.expiresAt ? `token expires ${new Date(ig.expiresAt).toLocaleDateString()}` : "token never expires"}
              </span>
            )}
          </div>
          {ig?.connected && (
            <div className="row">
              {ig.ok && ig.canUpload && (
                <button className="btn small" disabled={test === "Uploading a test draft…"} onClick={testUpload}>Test upload (doesn't post)</button>
              )}
              <button className="btn small" onClick={() => setForm(!form)}>{form ? "Cancel" : "Reconnect"}</button>
              <button className="btn small ghost" onClick={disconnect}>Disconnect</button>
            </div>
          )}
        </div>

        {ig?.connected && !ig.ok && ig.error && <p className="warn-text small">{ig.error}</p>}
        {test && <p className={`small ${test.startsWith("Upload works") ? "ok-text" : test.startsWith("Test failed") ? "warn-text" : "muted"}`}>{test}</p>}
        {ig?.connected && ig.ok && !ig.canUpload && (
          <p className="warn-text small">
            Posting needs the private video bucket. Run <code>gcloud auth login</code>, then <code>bash tools/setup_reels_bucket.sh</code> once.
          </p>
        )}
        {ig?.connected && ig.canUpload && ig.uploadTokenExpiresAt && ig.uploadTokenExpiresAt - Date.now() < 10 * 86_400_000 && (
          <p className="warn-text small">Posting access expires {new Date(ig.uploadTokenExpiresAt).toLocaleDateString()}. Reconnect with a new token before then.</p>
        )}
        {ig?.connected && ig.missingScopes.length > 0 && (
          <p className="warn-text small">
            Can't publish yet: the token is missing {ig.missingScopes.join(", ")}. Reconnect with a token that has it.
          </p>
        )}

        {showForm && ig !== null && (
          <div className="connection-form">
            <p className="muted small">
              In <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer">Graph API Explorer</a>, pick
              your app, add the permissions <code>{PERMISSIONS}</code>, then choose <em>Get User Access Token</em> and select the
              Page linked to your Instagram. App ID and App Secret are under App settings → Basic. They're saved on this Mac only
              (<code>secrets/instagram.json</code>); the short-lived token is swapped for a Page token that doesn't expire.
            </p>
            <label>
              <span>User access token (starts with EAA)</span>
              <input type="password" autoComplete="off" value={userToken} onChange={(e) => setUserToken(e.target.value)} />
            </label>
            <div className="details-grid">
              <label>
                <span>App ID</span>
                <input autoComplete="off" inputMode="numeric" value={appId} onChange={(e) => setAppId(e.target.value)} />
              </label>
              <label>
                <span>App Secret</span>
                <input type="password" autoComplete="off" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} />
              </label>
            </div>
            <div className="row">
              <button className="btn small primary" disabled={busy || !userToken.trim() || !appId.trim() || !appSecret.trim()} onClick={connect}>
                {busy ? "Connecting…" : "Connect Instagram"}
              </button>
            </div>
          </div>
        )}
        {error && <p className="warn-text small">{error}</p>}
      </div>

      <div className="connection muted small">
        <div className="connection-head">
          <span className="avatar">▶️</span>
          <div className="connection-info">
            <strong>YouTube</strong>
            <span>Coming next</span>
          </div>
        </div>
      </div>
    </div>
  );
};
