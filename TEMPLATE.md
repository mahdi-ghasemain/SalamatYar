# Reference template implementation

Update 2026-09-30: the formerly disconnected auth, maps, file attachment, backup/restore, barcode and visit reminder controls now call the implementation described in `SETUP-FA.md`. Live Supabase/OAuth/map-provider configuration is still required. The original template-stage service list below is historical.

The supplied 24-panel image is implemented as connected mobile screens. Font: bundled Vazirmatn Light, Regular, Medium, SemiBold and Bold. Persian RTL and English LTR, Persian/Gregorian date display, light/dark themes.

## Screen map

| Reference | Application route or action |
| --- | --- |
| Splash | `/splash` or first launch |
| Onboarding 1–3 | `/onboarding?item=0`, then Next |
| Login/register | `/login` |
| Home / dark home | `/`, appearance in Settings |
| Medicine list / add / detail | `/medicines`, Add, selected card |
| Reminders | `/reminders` |
| Visits / add / details | `/appointments`, Add, selected card |
| Tests / results | `/labs`, selected card |
| Medical records | `/records` |
| Family / member | `/family`, selected card |
| Health charts | `/metrics` |
| Profile/settings | `/settings` |
| Notifications | `/notifications` |
| Articles | `/articles`, selected card |
| Care centers | `/centers` |
| Screen directory | `/gallery` |

## Local behavior

Add/edit medicines and inventory, record/undo daily intake, delete medicines with confirmation and notification cancellation. Local daily notification activation is available in native builds. Add/edit/cancel/restore local appointments. Add/delete health notes and lab notes. Add/edit family profiles, record measurements and plot stored values. Search and filters, theme and calendar settings. Old saved data is migrated with new defaults.

Demo mode is opt-in, memory-only, labelled on every screen, and does not overwrite or save to the personal data store. Drug names and laboratory values in the demo are synthetic UI examples, never suggested care instructions. Native notification scheduling is disabled in demo mode.

## Deliberately unconnected services

Authentication, Google/Apple sign-in, password recovery, barcode scanning, file attachments, lab value extraction, online appointment booking, cloud backup and online family sharing are not connected. The UI explicitly says so. The care-center map is illustrative; the user can open an external map search by entering a place. No live coordinates or fabricated distances are presented. Educational cards contain information-organization tips, not medical advice.

Login fields are a visual preview; no credentials are transmitted or persisted. Current local storage lacks dedicated encryption; use sample data until production privacy/security work is complete. No signed APK, live-device notification test or store publication has been completed.

## Artwork

Onboarding illustrations are displayed from clipped regions of the user-supplied reference sheet in `assets/reference.png`. Their resolution is limited by that reference; separate high-resolution artwork can replace them later. Logo, cards, charts, icons, layout and controls are implemented as application UI.
