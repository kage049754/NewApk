# NewApk Roadmap

## Product rules
- Independent React Native rewrite; never modify CampusOS.
- Offline-first: no backend, cloud database, sign-in, or network dependency for core planner data.
- Excluded: attendance, calculator, study timer/Pomodoro, date calculator, unit converter, grade calculator, IT/CS utilities, exam reminders, student registration/login, announcements, group chat, group creation, group leadership, member search, online administration, invitation links/QR, admin approval, announcement images.
- CampusOS-inspired Forest, Sunset, Monochrome and customizable appearance.
- User-selected UI references for all seven modules are documented in [UI_DESIGN_REFERENCES.md](UI_DESIGN_REFERENCES.md); implement those layouts as the visual direction.

- Standalone Academics tab removed; subjects remain managed through Schedule.
- Budget is a primary navigation module.

## Milestones
- [x] Inspect CampusOS source repository and document feature scope.
- [x] Create initial React Native Android project foundation.
- [x] Add SQLite schema for subjects, classes, tasks, notes, activities and settings.
- [x] Add initial dashboard, local list creation and appearance selector.
- [x] Verify initial and iterative GitHub Actions debug APK builds.
- [x] Implement the core weekly timetable, subject/class creation, class removal and overlap detection.
- [x] Add the seven-day horizontal timetable grid with per-day class blocks and a switchable Day detail view.
- [x] Implement the Tasks overview with categories, priorities, due dates, search, filters and completion tracking.
- [x] Implement Notepad categories, subject linking, note editing, pinning, search and deletion.
- [x] Implement personal activity and appointment create/edit/delete with date/time, notes and a Home dashboard preview.
- [x] Complete task editing, checklists and optional task-to-Notepad linking.
- [x] Implement category spending analytics, monthly category limits and savings-goal tracking.
- [x] Add budget transaction editing and deletion with dashboard/widget refresh.
- [x] Add monthly Budget CSV report export and automatic category-limit rollover (limits only; no balance carryover).
- [x] Add the offline lecture-file library, subject/category grouping, Android document picker, private file copies and external-app opening (CI/runtime verification pending).
- [x] Implement cross-module dashboard refresh and local widget synchronization after planner data changes.
- [x] Add optional local profile-name personalization to the Home greeting and avatar.
- [x] Add weekly due/overdue task and savings-goal snapshots to the Home dashboard.
- [x] Highlight the in-progress or next scheduled class on Home with a direct link to the current Day view.
- [x] Refine Home task deadline labels/counts and show individual savings-goal progress bars.
- [x] Implement local notifications, class/task/activity reminders, sound/vibration, snooze/dismiss, boot/time-change rescheduling and exact-alarm access.
- [ ] Test actual notification delivery, alarm sound/vibration, snooze/dismiss, reboot recovery and device-specific battery behavior.
- [x] Implement seven Android home-screen widgets: Today&#39;s Classes, Weekly Schedule, Upcoming Tasks, Deadline Overview, Budget Overview, Savings Goals and Quick Expense.
- [ ] Test widget installation, launcher rendering, resize behavior, live refresh and Quick Expense handoff.
- [x] Implement persistent Forest, Sunset, Monochrome and Night appearance presets.
- [x] Add editable custom color combinations for backgrounds, cards, primary/accent, text and borders.
- [x] Add offline JSON backup and validated restore to Settings.
- [x] Add a storage information panel with database/file totals and local cleanup guidance.
- [x] Include actual Lecture File contents in NewApk JSON backup v2 with backward-compatible v1 restore.
- [x] Add local profile-name personalization.
- [x] Implement module-aware JSON backup/export and validated restore/import (Lecture File contents remain device-local).
- [x] Add validated CampusOS Backup v1/v2 migration for full Homepage, Schedule, Tasks and Academics exports, including subject-linked notes and Base64 lecture files (up to 12 MB total).
- [x] Add Jest unit tests for CampusOS backup conversion, malformed/partial input, timetable row validation and lecture attachment size limits.
- [x] Add Jest tests for Home task week boundaries, overdue separation, date validation and combined savings progress.
- [ ] Expand automated unit and UI test coverage beyond the CampusOS migration and Home dashboard calculation suites.
- [x] Verify standalone QA APK installation, offline startup and Home-screen rendering in an Android API 35 x86_64 emulator.
- [ ] Verify data persistence across app relaunch, cross-module navigation, notification delivery and alarm behavior in emulator/device testing.
- [ ] Prepare release APK and document physical-device testing separately.


## APK packaging
- [x] Add a standalone QA APK with an embedded React Native bundle and CI signature verification.
- [x] Download and inspect the run #47 standalone QA APK: archive integrity, DEX presence and embedded React Native bundle confirmed; CI signature check passed.
- [ ] Prepare the production-signed release APK (the CI QA APK uses the generated debug key).


## Android runtime smoke verification
- [x] Fix React Native 0.76 merged native-library loading by initializing SoLoader with `OpenSourceMergedSoMapping`.
- [x] Fix SQLite startup schema initialization: execute awaited statements outside async transaction callbacks and cache/retry the database-open promise.
- [x] Fix backup restore transaction scheduling: queue `tx.executeSql` calls synchronously inside the transaction so the restore remains atomic.
- [x] Improve startup SQLite error diagnostics and make emulator smoke failures print the captured UI hierarchy.
- GitHub Actions run #63 for commit `dd202981b5c88b25fadc25bd7399572cc01db275` completed successfully: all 13 Jest tests, debug APK build, standalone QA APK build, embedded React Native bundle verification, CI APK signature verification, artifact uploads and emulator smoke test passed.
- The API 35 x86_64 emulator installed the standalone APK with Wi-Fi and mobile data disabled, launched `MainActivity`, kept the application process alive and found the Home heading `Make today count.` in the UI hierarchy. No fatal Android/React Native errors were logged.
- Smoke evidence artifact ID: `14559764535`. The screenshot and UI hierarchy were inspected; the Home screen appeared without the previous SQLite error dialog.
- Standalone QA artifact ID: `14562040058`; extracted APK size: 48,061,149 bytes; embedded `assets/index.android.bundle`: 994,816 bytes; `classes.dex` and Hermes/React Native native libraries are present.
- Standalone QA APK SHA-256: `a2fcb4ade6e3eeefa7223caa8b39919584bacbff391a394f6219da8d31b423cf`. APK ZIP integrity passed and CI signature verification passed.
- This is an emulator startup/UI smoke test, not a complete feature test. Persistent data across relaunch, module navigation, notification delivery, widgets and the physical Infinix device remain unverified. The QA APK is signed with the generated Android debug key, not a production key.
