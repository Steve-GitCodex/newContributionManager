# Migration Backlog

Deferred work from the Firestore consolidation. Database readiness comes first;
app changes wait until the database is settled.

Target: `organizations/{slug}/*` subcollections in `universal-contribution-manager`.
Source: `contribution-manager-8fe43` Realtime Database (legacy nested schema).

---

## Database readiness (current focus)

- [x] **Deploy the new Firestore rules.** Deployed and verified live by unauthenticated
      probe: org metadata readable (200), `superadminUsers` closed (403), contribution
      documents closed (403).
- [x] **Verify the rules by execution.** 32/32 passing, including all 15 positive
      (should-succeed) assertions. Tests live in `tests/rules/firestore-rules.test.js`
      and run against the Firestore emulator:
      ```
      $env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.12.8-hotspot"
      $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
      npx firebase emulators:exec --only firestore --project rules-test-contriflow "npx vitest run --config vitest.rules.config.js"
      ```
      `JAVA_HOME` must be set explicitly — the machine's default `java` is 8, and
      firebase-tools requires 21+.
- [x] **Commit the migration.** 295 documents written. Verified against live Firestore:
      all 10 collection counts match, 24,650 pledged and 16,500 paid reconcile with source.
- [x] **Remove `firebaseConfig` from both org documents.** Stripped from
      `aic-isovya-praise` and `kyuso-welfare`. Public view now exposes only
      slug/id/name/status/createdAt/updatedAt.
- [x] **Migrate auth users** — done. `firebase-tools` authenticates with a service account
      via `GOOGLE_APPLICATION_CREDENTIALS`, so no interactive login was needed. The SCRYPT
      parameters are *not* in the `auth:export` output; they came from the Identity Toolkit
      admin API (`GET /admin/v2/projects/{id}/config` → `signIn.hashConfig`).

      **UID merge:** the superadmin account (`DjQccZJ4hAP…`) and the org admin account
      (`X97HExioj…`) shared the email `musyokanzau3@gmail.com` across the two projects.
      Firebase forbids two UIDs on one email, so `X97HExioj…` was not imported; its org
      membership (role `admin`) and its budget document (2 expenses) were repointed to
      `DjQccZJ4hAP…` and the originals deleted. If anything ever references `X97HExioj…`,
      that is why it is gone.

      Export artifacts (`users-source.json`, `users-import.json`, `hash-config.json`)
      were deleted after use — they contained password hashes and the signer key.

      Old superseded instructions, kept only for reference:
      ```
      npx firebase auth:export users.json --format=json --project contribution-manager-8fe43
      # read hash_config from the top of users.json, then feed those values below
      npx firebase auth:import users.json --project universal-contribution-manager \
        --hash-algo=SCRYPT --hash-key=<base64_signer_key> \
        --salt-separator=<base64_salt_separator> --rounds=<n> --mem-cost=<n>
      ```
      The hash parameters must match `hash_config` exactly or every password silently
      breaks. 3 users to move: two `admin`, one `viewer`. Delete `users.json` afterwards —
      it contains password hashes (already covered by the `keys/` gitignore rule? No —
      add it explicitly).
- [x] **Deleted the stale `kyuso-welfare` org document.** It had no subcollections.
      `organizations` now contains only `aic-isovya-praise`. Recreate it through the
      superadmin dashboard when ready — no Firebase config needed any more.
- [x] **Org creation no longer requires per-org database credentials.**
      `createOrganization(orgName, adminEmail, adminPassword)` creates the admin on the
      central project via a throwaway Firebase app (so the super admin's own session is
      not replaced), writes the org document with no `firebaseConfig`, and writes
      membership to `organizations/{slug}/users/{uid}` in Firestore where the rules read
      it. The config textarea, `parseFirebaseConfig`, `autoFormatJSON`, and the
      `admin@temp.local` / `TempPass123!` placeholder credentials are all gone.
- [ ] **Retire `contribution-manager-8fe43`** only after the app runs against the new
      database. It is the only rollback that exists.

### Domain model — do not conflate these

`users/{uid}` and `members/{id}` are unrelated despite both describing people.

| | `users/{uid}` | `members/{id}` |
|---|---|---|
| What | Firebase Auth accounts — people who log in | Names appearing on contribution records |
| Key | Auth UID (`X97HExioj…`) | Name slug (`angela`, `joel-ng`) |
| Count | 3 | 16 |
| Has a password | Yes | No — never had an account |
| Used by rules | Yes, gates all access | No |

Only the 3 `users` move in the auth import. Contributors are strings on contribution
records, not system identities.

- [ ] **Decide whether `members/` should exist at all.** It is derived from distinct
      contribution names at migration time, and nothing in the app reads it. As written it
      can drift out of sync with the contributions it was generated from. Either drop it,
      or make it authoritative and have contributions reference it.

### Open question — rules evaluation errors

The emulator logs `evaluation error` for 14 rule evaluations. All 14 occur on requests
that are **correctly denied**, and no should-succeed assertion is affected. Three
hypotheses were tested and disproved: null-auth path construction (added a `uid()`
guard — no change), the `exists()`+`get()` access budget (collapsed to a single `get()`
— no change), and non-null-safe `.data.role` (switched to `.data.get('role','')` — no
change). Notably `isOrgStaff` evaluates cleanly at one line while `isOrgAdmin` errors at
another in the same request, which rules out a simple helper bug.

Risk assessment: an evaluation error inside an `||` could in principle deny a grant that
should succeed. All 15 positive assertions pass — superadmin override, admin writes,
staff writes, viewer reading and writing its own budget — so no such case exists in the
covered surface. Treated as a diagnostic smell, not a blocker. Worth revisiting if a
legitimate access is ever denied in production.

## App changes (after the database is settled)

### Phase 1 — org entry restored (done)
- [x] **Stop threading `firebaseConfig` through the entry chain.** `pages/organization.html`
      stores `{slug, name}` only; `org-app` loads `firebase-firestore-compat` instead of
      `firebase-database-compat` and initializes from the central config it already ships.
      `FirebaseManager` is now connection-only (`getApp`/`getFirestore`/`getAuth`); its
      legacy `loadData`/`saveData`/`syncData` blob methods are gone, as are the legacy
      fallbacks in `app.js`.
- [x] **`OrgDb` is a Firestore path helper** rooted at `organizations/{slug}`, exposing
      `collection`/`doc`/`getAll`/`getOne`/`setOne`/`batch`. Slug is picked up from
      `window.orgSlug` at load. 13 tests.
- [x] **`auth.js` reads membership from Firestore** (`organizations/{slug}/users/{uid}`).
      Self-registration is gone — a non-member now gets "ask an administrator to invite
      you" instead of a write that the rules would reject anyway.
- [x] **Deleted `js/services/org-loader.js`** (dead) and the per-org Firebase app
      machinery in `org-manager.js` / `state-manager.js`.
- [x] **`pages/organization.html` was missing `config-generated.js`** entirely, so it fell
      back to the placeholder API key in `config-central.js`. Added.
- [x] Verified in a browser: org list → click org → org-app login screen, no console errors.

### Phase 2 — data layer on Firestore (done)
- [x] **`contribution-mapper.js`** owns the blob ↔ flat conversion for contributions,
      blacklist and campaigns. Ids are deterministic and match what the migration wrote
      (`${year}-${MM}-${member-slug}`, `--2` for repeats), and an id already on a row is
      reused rather than regenerated. **This closes the ID-churn bug.** 22 tests.
- [x] **`data-adapter.js` reads Firestore** — `contributions`, `months`, `blacklist`,
      `campaigns`, `campaignContributions`, `meta/state`, `budgets/{uid}`. No legacy
      branch.
- [x] **`data-write-adapter.js` writes via `writeBatch`**, chunked at 450 ops, deleting
      records absent from the incoming data. 13 tests.
- [x] **`specialGiving` renamed to `campaigns`** throughout, matching the rules allowlist.
- [x] **Deleted `org-app/js/data-migration.js`** — the one-time legacy flattening, already
      done offline by `scripts/migrate/`.
- [x] **`org-app/admin-dashboard.html` moved to Firestore**, including the admin gate.
- [x] **`js/pages/landing.js` superadmin check** moved off RTDB.
- [x] Verified against live Firestore with the service account: 247 contributions across
      19 months rebuild to a total of 24,650, and a flatten → rebuild → flatten round trip
      produces **byte-identical ids** for both contributions and campaign contributions.
### Blocking
- [x] **Real login confirmed against the new data layer.** Signing in works and data
      loads, which also proves the auth import preserved the SCRYPT password hashes and
      that the rules permit the reads `DataAdapter.loadAll()` issues as a member.
- [ ] **A save has still never been executed against live data.** `DataWriteAdapter`
      reconciles: any record absent from the incoming blob is *deleted*. The id round trip
      was verified read-only against production, but no write has run. Test with a single
      small edit and confirm the document count stays at 247 before trusting a bulk edit.

### Phase 3 — roles and membership (done)
- [x] **Invite UI.** `org-app/js/member-invite.js` plus a form on the admin dashboard.
      The account is provisioned on a throwaway Firebase app so the admin's own session
      survives, then `organizations/{slug}/users/{uid}` is written — which the rules
      already allow an org admin to do. An email that already has an account is added to
      the org rather than rejected. 13 tests.
- [x] **`editor` (staff) is enforced.** `ui-renderer.applyRoleRestrictions` now computes
      `isStaff` (admin or editor) instead of `isViewer`, so staff see contribution
      controls and members do not, and blacklist removal is admin-only. `app.js` refuses
      to save for anything other than admin/editor before it reaches Firestore.
- [x] **Superadmin can enter any org.** `auth.js` falls back to `superadminUsers/{uid}`
      when there is no membership, matching what the rules already permit.
- [x] **Role labels match the intended vocabulary** — Admin / Staff / Member in every
      dropdown. The *stored* values stay `admin` / `editor` / `viewer`; renaming the
      stored values would mean a data migration plus a rules change for no behavioural
      gain, so it was deliberately not done.

### Cleanup (done)
- [x] Deleted `js/services/firebase-service.js`'s RTDB org-instance block (146 lines) and
      `handleDatabaseError` — dead once per-org databases went away.
- [x] Deleted four `tests/unit/` files that re-implemented the module under test instead
      of importing it (`firebase-service`, `org-manager`, `state-manager`,
      `super-admin-service`). Each has a real counterpart in `tests/` that imports the
      actual source. ~2,000 lines that could never catch a regression.
- [x] Deleted `js/pages/landing.js` (no importers, no HTML reference),
      `org-app/firebase.rules` (RTDB rules), `migration-payload.json`, `landing.png`,
      `orgs.png`, and two duplicate `showToast` definitions.

### Security fix — superadmin self-promotion (deployed 2026-08-14)
The old rule was `allow create: if isSignedIn() && request.auth.uid == uid`, so **any
signed-in user could write `superadminUsers/{their-own-uid}` and gain access to every
organization.** Signup is open, so this was reachable by anyone. `SETUP_CODE` did not
protect it — that check ran in the browser, and an attacker calls Firestore directly.

Creation is now gated on `systemConfig/setup` not existing, so the gate closes
permanently after first-run bootstrap, and `update`/`delete` are denied outright.
Verified: 38/38 emulator assertions, including that bootstrap still works on a fresh
project. Deployed via the Firebase Rules API (the CLI path needs a `serviceusage`
permission this service account does not have).

Further superadmins must now be added out of band with the Admin SDK or the console.

### Config pipeline removed
`build.js`, `config-generated.js`, the seven `FIREBASE_*` env vars and `SETUP_CODE` are
all gone. The Firebase web config now lives in `config-central.js` and is committed — it
identifies the project rather than authenticating anyone, exactly like a Supabase anon
key, and it already shipped to every browser. Security is Firebase Auth plus
`firestore.rules`. `vercel.json` no longer has a `buildCommand`; there is no build step.

This also fixed a latent bug: `pages/organization.html` never loaded
`config-generated.js`, so it had been falling back to the placeholder API key.

### Still open
- [ ] **Password change.** Members are given a starter password by an admin and there is
      no in-app way to change it. Firebase's password-reset email is the cheap fix.
- [ ] **Removing a member** is not possible from the UI; roles can be changed but not
      revoked, so a departing member keeps access until someone edits Firestore by hand.
- [ ] **Email enumeration.** Signup must stay enabled at the project level because
      `MemberInvite` provisions accounts with the client SDK, so
      `auth/email-already-in-use` reveals whether an address is registered — regardless of
      any UI wording. Mitigate by restricting the API key to the deployed origin and
      enabling Email Enumeration Protection. Closing it properly means moving invites to
      the Admin SDK, which needs the Blaze plan.

### UX and access fixes (done, after Phase 3)
- [x] **Login failure hung forever.** `Swal.close()` sat after the `await`, the call passed
      `showUI: false`, and the error code was unmapped. Probing the live project showed SDK
      9.22 returns `auth/invalid-login-credentials` (12.x returns `auth/invalid-credential`)
      — both now map, to an identical message so a login never reveals whether an email is
      registered. Raw `error.message` no longer reaches the user on the superadmin login or
      setup pages.
- [x] **Signup form removed** from the org app; accounts come from the invite flow.
- [x] **Role gating rewritten declaratively.** The old `applyRoleRestrictions` hid a fixed
      list of elements at three moments, so anything rendered later was never restricted —
      and two of its four targets (`.add-contribution`, `.actions`) did not exist in the
      markup at all. Now `data-role` on `<html>` plus `data-requires` on controls, enforced
      by `css/roles.css`. 23 staff + 8 admin attributes, 2 via `dataset.requires`.
      **A first pass missed 9 controls** — including the per-row Blacklist button and the
      Create/Clone Month buttons built with `createElement` — because the test enumerated
      what had been tagged rather than what exists. The test now scans the source for
      mutating verbs and fails on any ungated control; verified it detects a removed gate.
- [x] **Org entry hardened.** `pages/organization.html` is the only page that reads a slug
      from a URL; it hands over via `sessionStorage` and the app opens on a clean
      `/org-app/index.html`. A pasted `?slug=` cannot select an organization. The entry page
      carries no Firebase SDK, so this costs nothing. Navigation hygiene, not access control.

### Correctness and cost
- [x] **Lossy round-trip fixed.** `ContributionMapper` carries `notes`, `createdAt` and
      `createdBy` through flatten → rebuild → flatten, with a test asserting it.
- [x] **N+1 reads fixed.** `loadCampaigns` and the campaign write path now read whole
      collections once; no `await` remains inside a loop in either adapter.
- [ ] **Startup loads everything** — 247 documents per launch. Firestore bills per document
      read. Fine on Spark's 50k/day, but the access pattern wants per-month queries.
- [ ] **Budget scoping mismatch.** The app reads `budgets/{uid}`; the admin dashboard
      aggregates the whole `budgets` collection. Predates this work.

### Cleanup
- [x] `js/pages/landing.js` deleted — the RTDB `superadminUsers` read went with it.
- [x] `org-app/firebase.rules` deleted — the duplicate `users` key is moot.
- [x] `firestore.rules` is back in sync with what is deployed, and was deployed *from* the
      repo. Keep it that way: deploy rules from the repo, never edit them in the console.
- [ ] **Oversized files.** `event-handlers.js` (1414 lines) and `templates.js` (823) are
      well past the ~400-line limit; `ui-renderer.js` (699) too. `auth.js` is down to 420
      from 538. Splitting these is the largest remaining tidy-up.
- [ ] `tests/unit/app-initializer.test.js`, `service-container.test.js` and
      `setup-status.test.js` test copies rather than the real modules. They have no real
      counterpart, so deleting them would drop those modules to zero coverage; they need
      rewriting to import the actual source.
