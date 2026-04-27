export {};

/** Minimal typing for `initTokenClient` (Google Identity Services) used by Calendar API. */
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string; error_description?: string }) => void;
          }) => { requestAccessToken: (overrides?: { prompt?: string }) => void };
        };
      };
    };
  }
}
