# Thermal Label Studio — Implementation Plan

> Retired reference. This plan targets one OFFNOVA printer and lets the local app own printing. The current rewrite is defined by `README.md` and `CONTEXT.md`; Fleet owns printer delivery.

## 1) Objective
Build an execution-ready Thermal Label Studio that supports:
- Visual 4x6 label design/editing
- Reusable templates with placeholders
- API-driven render/preview/print for OpenClaw automation
- Telegram/OpenClaw workflows for fast “fill + print” label jobs
- Reliable output for OFFNOVA/PM-241-BT TSPL pipeline

---

## 2) Scope (MVP → V1)

### MVP (must-have)
1. Template CRUD + versioning
2. Placeholder system (typed variables with defaults/validation)
3. Render endpoint (PNG preview + print-ready bitmap)
4. Print endpoint integrated with existing `thermal_print.sh`
5. Basic web editor: canvas, text/image layers, move/scale/rotate, alignment
6. Telegram/OpenClaw flow: choose template → fill fields → preview → confirm print

### V1 (next)
1. Sticker sheet mode (2x3 labels on 4x6)
2. Batch printing (CSV/JSON payload)
3. Saved presets for recurring label jobs
4. Print queue and job history UI
5. Advanced typography/QR/barcode components

---

## 3) Proposed Architecture

## Monorepo Layout
- `apps/web` (Next.js or Vite + React)
  - Template library, editor canvas, field form, preview, print confirmation
- `apps/api` (Node.js/TypeScript, Fastify or Express)
  - Template service, render service, print service, webhook endpoints
- `packages/core`
  - Template schema + validator (Zod)
  - Rendering engine (node-canvas / sharp pipeline)
  - TSPL exporter/adapter helpers
- `packages/templates`
  - Starter template JSON packs

## Runtime Components
1. **Web UI** → sends template/layout updates to API
2. **API** validates template + payload, calls renderer
3. **Renderer** outputs:
   - preview PNG (web)
   - print bitmap (800px width, monochrome)
4. **Print service** calls:
   - `bash /home/monroe/clawd/pi_printer/thermal_print.sh "<rendered-file-path>"`
5. **Automation adapter** exposes OpenClaw-friendly endpoints and Telegram flow helpers

## Key Non-Functional Requirements
- Deterministic rendering (same input => same image)
- Print-safe constraints (exact 800px width)
- Idempotent print requests with request IDs
- Audit log for template version + print job metadata

---

## 4) Data Model (Templates + Placeholders)

## Core Entities

### Template
- `id` (uuid)
- `slug` (string, unique)
- `name` (string)
- `description` (string)
- `mode` (`full_4x6` | `sticker_sheet_2x3`)
- `canvas`:
  - `widthPx` (number; default 800)
  - `heightPx` (number; e.g. 1200 for 4x6 at target density)
  - `dpiVirtual` (number; optional for layout math)
- `layers` (array of Layer)
- `placeholders` (array of PlaceholderDef)
- `printProfileId` (string, defaults to `offnova_default`)
- `version` (semver-like integer or string)
- `status` (`draft` | `published` | `archived`)
- `createdAt`, `updatedAt`, `createdBy`

### Layer (discriminated union)
Common fields:
- `id`, `type`, `x`, `y`, `width`, `height`, `rotation`, `zIndex`, `visible`, `locked`

Layer types:
1. `text`
   - `textSource`: literal string or placeholder reference
   - `fontFamily`, `fontSize`, `fontWeight`, `align`, `lineHeight`, `letterSpacing`
   - `maxLines`, `overflow` (`clip` | `shrink` | `wrap`)
2. `image`
   - `imageSource`: asset URL/path or placeholder reference
   - `fit` (`cover` | `contain` | `stretch`), `anchor`
   - `threshold`/`dither` settings for thermal conversion
3. `shape`
   - rect/line/circle primitives for borders and separators
4. `qr` (V1)
   - `valueSource` placeholder/literal, size, error correction

### PlaceholderDef
- `key` (e.g. `recipient_name`)
- `label` (human-readable)
- `type` (`text` | `multiline` | `number` | `date` | `enum` | `image` | `boolean`)
- `required` (bool)
- `defaultValue`
- `constraints`:
  - `maxLength`, `minLength`, regex, numeric min/max, enum options
- `format`:
  - built-ins (`uppercase`, `date:MM/DD/YYYY`, etc.)
- `ui`:
  - hint/help text, ordering, group

### PrintJob
- `id` (uuid)
- `templateId`, `templateVersion`
- `payload` (placeholder values)
- `renderArtifactPath` (png path)
- `status` (`queued` | `rendered` | `printing` | `done` | `failed` | `canceled`)
- `copies`
- `idempotencyKey`
- `requestedBy` (`web` | `telegram` | `openclaw` + actor)
- `error` (nullable)
- `createdAt`, `startedAt`, `completedAt`

---

## 5) API Contract (Execution-Ready)

Base: `/api/v1`

## Template APIs
- `POST /templates` → create draft template
- `GET /templates` → list templates (filter by mode/status)
- `GET /templates/:id` → get template detail
- `PUT /templates/:id` → update draft
- `POST /templates/:id/publish` → immutable version bump and publish
- `POST /templates/:id/archive` → archive template
- `GET /templates/:id/versions` → list historical versions

## Placeholder/Form APIs
- `POST /templates/:id/validate-payload` → validate data against placeholder defs
- `GET /templates/:id/form-schema` → UI schema for Telegram/web dynamic forms

## Render APIs
- `POST /render/preview`
  - body: `{ templateId|templateVersionId, payload, options }`
  - returns preview PNG URL/path + render metadata
- `POST /render/print-ready`
  - returns print-optimized monochrome artifact + checksum

## Print APIs
- `POST /print/jobs`
  - body: `{ templateRef, payload, copies, idempotencyKey, dryRun? }`
  - creates job and (unless dryRun) enqueues printing
- `GET /print/jobs/:id` → job status/detail
- `POST /print/jobs/:id/retry`
- `POST /print/jobs/:id/cancel` (if not started)

## Automation/Webhook APIs
- `POST /automation/telegram/fill-and-preview`
- `POST /automation/telegram/confirm-print`
- `POST /automation/openclaw/quick-print`
- `GET /health` and `GET /ready`

### API Standards
- JSON schema validation for all inputs
- Error model: `{ code, message, details, requestId }`
- Idempotency via `Idempotency-Key` header for print endpoints
- Auth: local token or OpenClaw internal trust boundary (configurable)

---

## 6) Print Pipeline (Thermal-Safe)

## Render to Print Steps
1. Resolve template + selected version
2. Validate payload against placeholder defs
3. Compose layers into high-contrast raster
4. Convert to print bitmap:
   - fixed width: **800 px**
   - grayscale → threshold/dither
   - ensure no alpha ambiguities
5. Persist artifact (e.g., `/tmp/thermal-label-studio/jobs/<id>.png`)
6. Execute print script:
   - `bash /home/monroe/clawd/pi_printer/thermal_print.sh "<artifact-path>"`
7. Capture stdout/stderr + exit code
8. Update job status and logs

## Reliability Controls
- Queue concurrency default = 1 printer worker
- Per-job timeout (e.g. 45s render, 60s print)
- Retry policy (max 2 retries on transient errors)
- Dead-letter capture for repeated failures
- Artifact retention policy (e.g. 7 days, configurable)

---

## 7) Telegram / OpenClaw Automation Flows

## Flow A: Quick Fill + Print (Telegram)
1. User command: `/label print`
2. Bot returns template buttons/list
3. User selects template
4. Bot asks placeholder questions dynamically from `form-schema`
5. Bot sends preview image
6. User taps **Print** or **Edit**
7. On Print, bot calls `/print/jobs` with idempotency key
8. Bot posts status: queued → done/failed

## Flow B: One-shot OpenClaw API
- Agent calls `/automation/openclaw/quick-print` with:
  - template slug
  - payload object
  - copies
- API validates, renders, prints, returns job result + artifact ref

## Flow C: Batch Mode (V1)
- Upload CSV/JSON with rows mapping to placeholders
- API validates all rows, returns preflight report
- User confirms, system submits sequential jobs

## Telegram UX Details
- Use inline buttons for: template select, confirm, retry, cancel
- Correlate conversations with `sessionId` + `requestId`
- Prevent duplicate prints via idempotency key derived from chat/message context

---

## 8) Milestones, Deliverables, Acceptance Criteria

## Milestone 1 — Foundations (Week 1)
Deliverables:
- Monorepo skeleton (`apps/web`, `apps/api`, `packages/core`)
- Shared TypeScript models + Zod schema for template/layers/placeholders
- Initial OpenAPI spec

Acceptance Criteria:
- Can create/validate a template JSON locally
- CI runs schema validation + lint + unit tests

## Milestone 2 — Rendering Engine (Week 2)
Deliverables:
- Layer renderer (text/image/shape)
- Placeholder substitution pipeline
- Preview + print-ready generation

Acceptance Criteria:
- Given test fixtures, renderer outputs deterministic PNGs
- Print-ready output always 800px width and monochrome-safe

## Milestone 3 — Template + Render APIs (Week 3)
Deliverables:
- CRUD + publish/version endpoints
- Payload validation endpoint
- Render preview endpoint

Acceptance Criteria:
- API tests pass for success/error paths
- Published templates are immutable by version

## Milestone 4 — Print Job System (Week 4)
Deliverables:
- Job queue + status tracking
- `thermal_print.sh` integration
- Retry/error handling

Acceptance Criteria:
- Dry-run and live print paths both validated
- Failed jobs retain diagnostics and can be retried

## Milestone 5 — Web Editor MVP (Weeks 5–6)
Deliverables:
- Canvas editor with drag/resize/align for layers
- Placeholder sidebar + field mapping
- Preview panel + print action

Acceptance Criteria:
- User can build template without manual JSON edits
- Saved template round-trips between web and API without data loss

## Milestone 6 — Telegram/OpenClaw Automation (Week 7)
Deliverables:
- Telegram fill/preview/confirm flow
- OpenClaw quick-print endpoint wrapper
- Inline button flow + state handling

Acceptance Criteria:
- End-to-end Telegram flow prints a label reliably
- Duplicate button taps do not duplicate print jobs

## Milestone 7 — Hardening + V1 Add-ons (Week 8)
Deliverables:
- Sticker sheet mode
- Batch validation + submission
- Observability dashboards/log summaries

Acceptance Criteria:
- Batch prints complete with per-row error reporting
- Mean successful job latency within target budget

---

## 9) Test Strategy

## Unit Tests
- Template schema validation
- Placeholder formatting/constraints
- Layer geometry and text overflow logic
- Dither/threshold conversion utilities

## Integration Tests
- API + renderer integration (fixture templates)
- Print service mock (script success/failure/timeout)
- Job state transitions

## Snapshot/Golden Tests
- Golden PNG comparisons for canonical templates
- Tolerance-based image diffs for renderer regressions

## End-to-End Tests
1. Web user creates template, publishes, previews, prints
2. Telegram flow from command to printed job
3. OpenClaw quick-print with idempotency protection

## Hardware-in-the-Loop (HIL)
- Scheduled smoke test prints on OFFNOVA_N-6140
- Validate physical output readability for text sizes and QR (V1)

## Performance/Resilience
- Render throughput benchmark under small queue load
- Retry behavior under simulated printer disconnect
- Recovery test after API restart with queued jobs

---

## 10) Observability & Operations
- Structured logs with `requestId`, `jobId`, `templateVersion`
- Metrics:
  - render duration
  - print duration
  - success/failure rates
  - queue depth
- Admin endpoints:
  - `/health`, `/ready`
  - `/metrics` (Prometheus format optional)
- Alerts:
  - consecutive print failures
  - stuck queue threshold

---

## 11) Implementation Order (Practical Next Actions)
1. Finalize JSON schema for template/layer/placeholders
2. Generate TypeScript types + validators from schema
3. Build renderer with fixture-driven tests
4. Expose render + template APIs
5. Add print job worker + script integration
6. Build minimal web editor over stable APIs
7. Implement Telegram/OpenClaw flows on top of form-schema + print endpoints
8. Add sticker-sheet and batch after MVP is stable

---

## 12) Definition of Done (Project-Level)
Thermal Label Studio is “done” for MVP when:
- A non-technical user can create/edit/publish template in web UI
- Telegram/OpenClaw can fill placeholders and print with preview confirmation
- Print output is consistently correct on OFFNOVA thermal pipeline
- Failures are diagnosable and recoverable (retry/status/logging)
- Test suite covers schema/render/API/print paths with CI green
