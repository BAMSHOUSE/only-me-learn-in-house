# Only Me Learn in House — Operations

New Site built from the two Stitch screens and Operations Engine design specification in the supplied ZIP.

## Implemented

- Thai-first Dashboard: five metrics, year/month/status/search filters, pagination, parallel track chips, CSV export.
- Job Detail: nine macro stages, progress calculated from approved milestones, parallel Video/PDF cards, final QA, timestamps, delivery.
- Named action dialogs, required revision notes, customer approval without a required contact channel, optional file references and due dates.
- Pipeline board and filterable audit history with CSV export.
- Shared D1 state; server-enforced prerequisites, conditional updates and request-key deduplication.
- Six fictional demonstration orders. Airtable, Drive and LINE are reference fields only.

## Access

The bare public URL opens the Dashboard immediately, without login, a password or a special link. The browser automatically receives a signed, expiring HttpOnly anonymous session cookie. API calls validate the cookie using the server-only DEMO_ACCESS_TOKEN signing secret; mutations require a same-origin request. Every visitor is allowed to use this public demo. Selecting a member name records attribution; it is not identity verification. No real customer data is included.

## Local development

Use the Sites plugin helpers to install and build. The project uses pnpm 11.25.0.
Generate database migrations with node node_modules/drizzle-kit/bin.cjs generate.
Apply the generated migration to local D1 using the starter README commands before previewing.

## Verification

The scripts/test-flow.mjs script exercises the full workflow against local D1, including rework, final-QA rejection, idempotency, file references and shared-state reads.

The scripts/test-browser.mjs script uses Playwright with installed Microsoft Edge to inspect desktop/mobile pages, record actions in two independent browser contexts, export CSV and create an order. Set PLAYWRIGHT_MODULE to the local Playwright module when it is provided by a host runtime. Screenshots are saved to ignored outputs/.

Local test data is separate from hosted D1. Publishing seeds only the six demonstration orders.

## Order intake

Manual order creation is removed from the UI and rejected by the public state API (403). Airtable Transaction ingestion is pending the base/table and paid-status mapping; no live Airtable trigger is configured. Existing demo orders remain available for workflow testing. Test orders are inserted into local D1 only using scripts/test-fixture.mjs.

