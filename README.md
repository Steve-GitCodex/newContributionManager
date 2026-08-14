# ContriFlow

Multi-tenant contribution tracking for churches, non-profits and community groups.
Each organization records monthly member contributions, runs fundraising campaigns,
tracks expenses against income, and reports on any of it.

Static files, no build step. Vanilla JavaScript with Firebase Auth and Firestore,
deployed on Vercel.

## Running locally

```
npm install
npm run dev            # http://localhost:4321
```

The dev server serves the repository as-is. No bundler, no environment variables —
what runs locally is what deploys.

## Deploying

Vercel serves the repository directly. `vercel.json` defines rewrites and nothing
else; there is no build command, so a push is a deploy.

## Layout

```
index.html      landing
pages/          organization entry and error pages
org-app/        the application
js/             shared services and utilities
css/            styles
assets/         images and icons
scripts/        operational tools, run manually against live data
```

Application modules are IIFE globals loaded by `<script>` tag, in dependency order.
A new module must appear in the list before whatever consumes it.

## Access

Organizations are isolated from each other by Firestore security rules, which read
the caller's membership document. Roles are Admin, Staff and Member, enforced by
those rules rather than by the interface — a browser can call Firestore directly,
so the UI only reflects what the rules already permit.

Accounts are created by invitation from the admin dashboard. There is no
self-registration.

## Local-only files

Tests, test configuration, Firestore rules and the Firebase deploy config are kept
out of this repository deliberately. It is the Vercel deploy source and Vercel needs
none of them; they live on the maintainer's machine and deploy from there.
