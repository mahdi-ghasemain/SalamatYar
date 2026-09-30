# Button and service status — 2026-09-30

| Flow | Implementation | Live dependency / verification limit |
|---|---|---|
| Email sign-up / confirmation / sign-in | Supabase Auth SDK | Configure project, redirects, SMTP; not tested against a live account |
| Google sign-in | Browser PKCE OAuth and callback route | Google OAuth client and Supabase provider required |
| Password reset / new password | Email recovery and authenticated update | Requires email delivery and matching redirect |
| Logout | Local auth session revoked, account-scoped UI remounted | Disabled while unsaved cloud changes remain |
| Guest mode | Original local store retained | Guest data is not automatically uploaded into an account |
| Profile / language / calendar / theme | Saved per guest or authenticated account | Cloud setup required for account persistence |
| Medicine create / edit / delete / inventory / taken / undo | Validated local actions and cloud state updates | Existing unit tests and template UI checks |
| Daily medicine reminder | Native notifications with stable device identifiers | Physical-device permission/delivery test required |
| Appointment create / edit / cancel / restore | Real saved records, cancellation turns off reminder | This is a personal appointment tracker, not booking with a clinic |
| Appointment reminder | Scheduled native date notification | Future date and device permission required |
| Clinic directions / call | Opens map or telephone for saved address/number | Device/app support and valid user-entered values |
| Lab note / values / record editor / delete | Real persisted values, no automatic interpretation | Server configured for signed-in records |
| Record attachment / open / delete | 10 MB image/PDF, private storage, short-lived signed URL | Supabase Storage policies; guest native files stay on-device |
| File selection cancel | Pending bytes discarded; selection alone does not upload | Replaced/deleted storage objects and metadata are not one atomic transaction; production orphan cleanup/reconciliation remains necessary |
| Barcode scan | Device camera scanner; scanned code enters recorded notes | Camera permission and native-device test; no invented drug-database lookup |
| Family add / edit / member views | Separate member records with consent checkbox | Online sharing with a second account is not implemented |
| Measurements / charts | Stored user measurements with range filtering | No clinical interpretation |
| Backup export / restore | JSON export, validated restore with explicit confirmation | Attachments are not embedded; saved passwords/tokens excluded |
| Cloud retry / reload | Version-based conflict detection and explicit reload | Unsaved account edits are session-memory only; export before closing during a failure |
| Real map / current location | Foreground GPS permission and embedded OpenStreetMap | HTTPS, device permission and network; not exercised with user's coordinates |
| Nearby list / filters / directions | Authenticated Edge Function, radius query and real distance calculation | Deploy function, configure Overpass provider; not live-tested |
| Articles | Opens complete built-in organization guides | No fake remote content or medical advice |
| Demo / onboarding / gallery | Interactive existing template | Demo data remains memory-only and never synchronizes |

## Capacity boundaries

RLS, owner-indexed records, server-side version checks, payload bounds, per-account write spacing, authenticated nearby request limits and map caching are implemented. The current per-account synchronization is a bounded full snapshot, not an unlimited medical-record database. No production concurrency capacity is claimed until the provided k6 workload is run on a representative staging deployment.

## Checks completed

- Seven tests, including SQL executed in embedded PostgreSQL: owner isolation, unauthorized mutation denial, old-version rejection, device notification identifier exclusion, date/inventory validation, restore validation and geographic distance.
- TypeScript and ESLint. TypeScript uses a larger Node stack for the current large template component.
- Web and Android bundle export; this is not an APK install/device test.
- Browser: onboarding, guest mode and account-form state changes; the missing-project state correctly explains why live authentication is unavailable.

See `SETUP-FA.md` for the configuration needed to activate the external services.
