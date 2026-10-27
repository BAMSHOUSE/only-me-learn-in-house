declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    AIRTABLE_INITIAL_IMPORT?: string;
    DEMO_ACCESS_TOKEN?: string;
    VAPID_PUBLIC_KEY?: string;
    VAPID_PRIVATE_KEY?: string;
    BUCKET?: R2Bucket;
  }
}
