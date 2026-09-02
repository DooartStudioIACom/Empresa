declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: KVNamespace;
    APP_AUTH_PROVIDER?: string;
    ALLOWED_EMAIL_DOMAINS?: string;
    CLOUDFLARE_ACCESS_TEAM_DOMAIN?: string;
    CLOUDFLARE_ACCESS_AUD?: string;
    DEMO_SESSION_SECRET?: string;
  }
}
