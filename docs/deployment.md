# Deployment status

Public Mission Control: https://seven-servers-lunar-first-light.vercel.app

Guided mission: https://seven-servers-lunar-first-light.vercel.app/demo

Local mission control is `/` and `/mission`. The browser plays the published report, the 169-hour playback, and the derived terrain meshes. New-site, date, mast, compare, and network actions call same-origin `/api/science/*`.

**Live recalculation: incomplete.** The Fly CLI is not installed and `FLY_API_TOKEN` is not set, so the DEM and SPICE service has no public host. `SCIENCE_ORIGIN` is empty on purpose. An empty origin returns 503, the controls stay disabled, and the published week is not labeled as a new run. The Vercel CLI is logged in as `preston-9480`. It was not given a science origin, and this workspace did not redeploy production.

Docker Compose sets `SCIENCE_ORIGIN=http://science:8000` for a local science container. That value is not a public address and is not written into the Vercel project.

The Vercel project is `accorrias-projects/seven-servers-lunar-first-light`, the team on the logged-in `preston-9480` account. This is not a git push, and the Accorria repository was not modified. Production signing was not enabled.

Supabase schema and row-level policies are in `supabase/migrations/20261115000000_mission_identity.sql`. They were not applied. The signed-in Supabase CLI can see Accorria Demo and The Keep Shared, which are separate systems. The judge path is the local demonstration cookie, mission id `SS-MS-2026-DEMO`.

NASA portal submission needs the founder's authenticated Space Apps session. The fields, seven slides, and references are in `docs/submission/`.
