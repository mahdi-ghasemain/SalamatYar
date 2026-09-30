# Verification — 2026-09-28

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
