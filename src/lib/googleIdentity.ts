const GSI_SCRIPT = "https://accounts.google.com/gsi/client";

/** Web OAuth 2.0 client ID (same project as Firebase — “Web client” in Google Cloud / Firebase console). */
export function getGoogleOAuthWebClientId(): string {
  return (import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined)?.trim() || "";
}

export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

let gsiLoad: Promise<void> | null = null;

export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gsiLoad) return gsiLoad;
  gsiLoad = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SCRIPT}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Google script failed")));
      if (window.google?.accounts?.oauth2) resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = GSI_SCRIPT;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google Identity script"));
    document.head.appendChild(s);
  });
  return gsiLoad;
}

/**
 * One-time or incremental OAuth2 access token for Google Calendar API.
 * User sees Google’s consent (or a quick account chooser) if needed.
 */
export function requestGoogleCalendarAccessToken(): Promise<string> {
  const clientId = getGoogleOAuthWebClientId();
  if (!clientId) {
    return Promise.reject(new Error("missing_client_id"));
  }
  return loadGoogleIdentityScript().then(
    () =>
      new Promise((resolve, reject) => {
        const g = window.google;
        if (!g?.accounts?.oauth2) {
          reject(new Error("gsi_unavailable"));
          return;
        }
        const client = g.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: GOOGLE_CALENDAR_SCOPE,
          callback: (resp) => {
            if (resp.error) {
              reject(new Error(resp.error));
              return;
            }
            if (!resp.access_token) {
              reject(new Error("no_access_token"));
              return;
            }
            resolve(resp.access_token);
          },
        });
        client.requestAccessToken({ prompt: "" });
      }),
  );
}
