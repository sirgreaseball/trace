# Progress — 2026-10-12

## Goal
Trace: a workspace for student software teams (SE lab project, v2 of "AI-Native Collaborative Knowledge OS"). Lusion-style WebGL splash + calm app. Public repo github.com/sirgreaseball/trace, commits as sirgreaseball only, no AI co-author trailers.

## Done
- Supabase project `trace` (ref wxcnxfvzyhdzburunwvh, ap-south-1). Schema + RLS + RPCs applied (`supabase/migrations/0001_schema.sql`). Demo data loaded from `0002_demo.sql` (5 fictional teams, 21 people), pg_cron `reset-demo` every 6 h. Demo logins (isha.kulkarni@example.com student, meenakshi.nair@example.com mentor) use DEMO_PASSWORD from `.env.local` (hash set in DB; plaintext only in .env.local).
- Trace engine `src/lib/trace.ts` + 7 passing tests (`npm test`).
- App pages: /enter, /home (mentor table), /join/[token], /w/[id] overview (loom), trace grid (+CSV), stories (+detail), board, commits (suggest/confirm/manual link), decisions (conflict alerts), chat (realtime, /decide), ask (search + optional AI), receipts (thermal paper, disputes, print), viva, settings. API: sync (GitHub + AI linker), ask, viva.
- Splash `src/components/splash/{engine.ts,splash.tsx}`: 7 thread formations, verified on real GPU (6.9 ms frames desktop + phone), no h-scroll.
- 2 commits pushed. Typecheck + lint were clean before the splash work.

## Uncommitted (saved on disk)
Splash files, conflict-rule fix (+test), globals.css splash/receipt styles, src/app/page.tsx, icon.svg, manifest.ts, launch config. Last edits (line at 0.8·halfH, overflow-x-clip, icon, manifest) not yet re-verified.

## Next steps
1. `npx tsc --noEmit -p .`, `npx eslint src`, `npm test`; rerun scratchpad `splash-check.cjs` (Playwright at C:\Users\dhruv\pw\node_modules\playwright) and look at desk-6/phone shots.
2. Commit + push as sirgreaseball (no trailers).
3. Seed recency tweak in `scripts/seed-demo.ts` (LF filters commit day 6→1.6, add a day-0.3 commit), `npm run seed`, push, re-run via http extension (see how 0002 was applied: fetch raw GitHub file by commit SHA, check md5, `execute`).
4. Deploy to Vercel (region bom1, env vars from .env.local incl. DEMO_PASSWORD, NEXT_PUBLIC_SITE_URL), add OG image, README.
5. User action: Supabase Auth → disable "Confirm email" so normal sign-up works; optional GROQ_API_KEY for AI.

## Running
Dev server "trace" (preview, port 3100, `.claude/launch.json` in Z:\claude). Turbopack on Z: sometimes misses file changes: touch the file if a change doesn't show.
