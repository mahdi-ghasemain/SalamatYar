# Verification — latest check 2026-10-01

- Typecheck and lint passed; all 7 automated tests passed, including account isolation and revision conflicts against the migration in embedded PostgreSQL.
- Configured live Supabase Auth settings returned HTTP 200: email enabled, signup enabled, email confirmation required, Google disabled.
- Anonymous live request to health_accounts returned HTTP 401 / 42501 (access denied). This does not establish authenticated CRUD or complete RLS coverage on the deployed service.
- No real-user signup, email delivery, password recovery, Google login, physical Android pilot, or staging load test was completed in this check. See PILOT-FA.md for acceptance steps.

## Android APK build attempt — 2026-10-01

Follow-up: the upload failure was resolved by explicitly setting EAS `https_proxy` to the existing Windows proxy for the build process. Source upload succeeded and EAS build `d99de5c5-ade0-44fc-a913-b1c582078238` entered IN_PROGRESS. `scripts/build-android.ps1` reuses the active Windows proxy without changing system settings. Final APK result pending.

Docker follow-up: added a multi-stage web image, non-root/read-only Nginx service, SPA callback routing and Docker Compose. Compose configuration and helper script syntax passed validation. The initial WSL update blocker was resolved by installing Microsoft-signed WSL 3.0.1 MSI from the official Microsoft GitHub release (installer exit 0). Docker Desktop restarted successfully. Image build completed, including typecheck, lint and seven passing tests. Container `mobile-web-1` is healthy on localhost:8090; Nginx config passed. HTTP checks: home, centers, callback and JS bundle 200; missing asset 404; hidden env path 403. These are serving checks, not a live authenticated browser test.

- Linked EAS project `bc8acfb0-6348-4838-bbcd-139842498aec` under `mahdi_ghasemian/salamatyar`.
- Preview profile explicitly builds an APK and uses the preview environment. Uploaded only the three public backend configuration variables to that environment.
- EAS generated the Android signing keystore and reused it on the second attempt.
- Both attempts failed uploading metadata and the 4.4 MB project archive with HTTP 403 (Forbidden). No cloud compilation or APK artifact was produced; the cause of the upload rejection is not established.
- Typecheck, lint, and all seven tests passed before the build attempts.
- Retry after resolving upload access: `npx --registry=https://registry.npmjs.org eas-cli@latest build --platform android --profile preview`.

## Historical check — 2026-09-28

- TypeScript: passed (`npm run typecheck`).
- ESLint: passed (`npm run lint`).
- Model tests: 4 passed (digit conversion, time/date validation, stock and history updates, local day keys).
- Expo export: web and Android Hermes bundles generated successfully. This is a bundle check, **not an APK build or device test**.
- Browser: Persian initial screen renders; English language switch and Gregorian date display work; sample medicine can be saved; marking taken reduces stock 30 → 29; reload preserves the recorded intake and stock.
- Browser interactions above were verified with keyboard activation. Mouse activation through the in-app browser automation did not trigger React Native Web Pressable handlers; cause remains unconfirmed. Real-device touch testing remains required.
- Android notifications: implemented, not exercised on a physical device. Permission denial and web-unavailable paths show an error message.
- Package installation reported 13 moderate advisories. Dependency review is still required before release.
- No signed APK/AAB has been built, no store release, and no backend or production security validation has been performed.

The browser preview contains explicitly synthetic test data. Native installations start empty.

Typography update: five bundled Vazirmatn weights added. TypeScript and ESLint passed. Browser computed styles verified title=700Bold, card title=600SemiBold, time=500Medium. Screenshot: artifacts/vazirmatn-preview.png.
