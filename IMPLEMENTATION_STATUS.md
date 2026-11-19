# Implementation Status

## Current state
Initial React Native foundation committed to `main`.

## Implemented in source
- React Native 0.76 JavaScript application entry point.
- Android native host files and Gradle configuration.
- SQLite database initialization and initial schema for subjects, classes, tasks, notes, personal activities and settings.
- Initial dashboard with live local counts.
- Basic local creation for tasks and notes; subject management will live inside Schedule.
- Budget module foundation: local income/expense transactions and monthly spending limits.
- Task completion toggle.
- Forest, Sunset, Monochrome and Night palette selection, now persisted locally; editable custom color combination also saved in SQLite.
- Main navigation shell for Home, Schedule, Tasks, Budget, Notes, Files and Settings.
- GitHub Actions debug APK workflow.
- User-selected visual references for all seven modules documented in [UI_DESIGN_REFERENCES.md](UI_DESIGN_REFERENCES.md).

## Tasks module update
- Added task priorities (Low / Medium / High), categories, optional calendar-date due dates and local persistence.
- Added weekly completion overview, open / due-this-week / completed counts, text search, All / Today / Upcoming / Completed filters, task completion controls and delete confirmation.
- Added a backward-compatible SQLite migration: existing task rows receive default Medium priority and Assignment category; new installs create the same columns directly.
- Task editing, checklists/subtasks, recurring tasks and reminder scheduling remain incomplete.

## Build verification
- GitHub Actions run #12 for commit `b0ae2a1dbf46c6bc69d9f38a1c34305c83e415cb` completed successfully.
- All build job steps completed successfully, including `Build debug APK` and `Upload APK`.
- Artifact `NewApk-debug` was generated (33,193,946 bytes; SHA-256 `0ca49cfc50c46b59c7b9370cb9faf333caf0514f939cd562116f3f28258e3427`).
- This confirms the debug APK artifact was produced; it does not confirm emulator launch, feature correctness, or physical-device behavior.
- No emulator or physical-device test has been completed.

## UI direction
- Selected layouts: Home #3, Schedule #6, Tasks #8, Budget #9, Notepad #12, Lecture Files #14, Settings / Appearance #16.
- These are implementation references only; the corresponding finished screens have not yet been built to match them.

## Schedule and build verification update
- Core weekly timetable, subject/class creation, class removal and overlap validation are implemented.
- GitHub Actions run #20 for commit `1bf9f4da43ac05270a5fd9c1420a22674dda615d` completed successfully; APK artifact `NewApk-debug` uploaded (33,193,954 bytes, artifact ID `14502061185`).
- The build verifies compilation and artifact upload only; it does not verify emulator launch or runtime behavior.

## Budget module update
- Expanded Budget #9 with an available-this-month hero, income/expense/balance totals, monthly spending progress, category spending bars, category-specific monthly caps and savings goals.
- Added savings-goal creation, progress percentages, money contributions and delete confirmation.
- Transaction categories are chosen from simple presets; existing custom categories continue to appear in spending summaries.
- Category limits use a new local SQLite `category_budgets` table keyed by month and category. Existing transactions and savings goals are preserved.
- Transaction editing/deletion, report export and automatic category-limit rollover remain incomplete.

## Tasks build verification update
- GitHub Actions run #22 for commit `82ab4a8bcbc759d61180ddcfc40c6e9453cbab14` completed successfully; Android debug APK compilation and artifact upload both passed.
- Artifact `NewApk-debug` was uploaded (33,193,951 bytes; artifact ID `14502352444`). This is CI build verification, not emulator or physical-device verification.
- The due-date validator correction is included in this successful commit.

## Personal activities update
- Added local create, edit and delete for appointments and personal plans with date, start/end time and optional notes.
- Home shows upcoming activities and offers direct add, edit and delete controls; changes reload from SQLite so the dashboard stays synchronized.
- Reuses the existing activities table; no backend or schema migration is required.

## Appearance build verification
- GitHub Actions run #27 for commit `4750af15b552a11c5dbb7b152927422276af2fcd` completed successfully. Android debug APK compilation and artifact upload passed.
- Artifact `NewApk-debug` was uploaded (33,208,984 bytes; artifact ID `14506211561`). This verifies compilation and upload, not on-device behavior.

## Known incomplete areas
Task editing/checklists, task editing/checklists, note editing/subject linking, transaction editing/deletion and report export, reminders/alarms, widgets, full backup/restore, data migration and comprehensive tests.

## Next action
Implement local reminder scheduling for classes, tasks and personal activities (notification permission, sound/vibration, snooze/dismiss), then inspect the next Android Actions result and verify its APK artifact.

## Tasks build verification
- GitHub Actions run #21 for commit `c0ac58192526f9f8f86db289cf364bbc802a6258` completed successfully; all job steps, including Android debug APK compilation and artifact upload, passed.
- Artifact `NewApk-debug` was uploaded (33,193,948 bytes; artifact ID `14502746052`). This verifies build and upload only, not emulator launch or runtime behavior.
- A source review caught and corrected an over-escaped due-date format validator in the follow-up commit; that correction requires its own passing build.

## Budget form review
- Corrected the shared budget modal so savings-goal forms do not show a transaction-title field and contribution forms only show the contribution amount.
- Budget build run #23 for commit `94bb6966076d8414acb4c67b5b7ec9fc3bccea63` completed successfully. The `NewApk-debug` artifact was uploaded (33,193,947 bytes; artifact ID `14502738584`).
- The modal correction is committed separately and requires its own passing build.

## Lecture Files module implementation
- Added an Android Storage Access Framework picker for PDFs, images, and common office/text document types.
- Selected files are copied into NewApk's private `files/lecture_files` folder (100 MB per-file limit) so imported copies remain accessible offline.
- Added FileProvider-backed opening with Android apps, local deletion, subject association, category labels, search and PDF/image/document filters.
- Added `lecture_files` SQLite metadata and a private-file provider path. No storage-wide permission or cloud service is required.
- Build and runtime verification for this native module is pending; external viewer availability depends on apps installed on the device.

## Notepad module update
- Added a note-library screen with category filters, text search, pinned-note count and compact note cards.
- Notes can be created, edited, pinned/unpinned, deleted and optionally linked to a subject.
- Added a backward-compatible SQLite migration for the new note category field; existing notes remain intact and default to General.
- Build and runtime verification are pending.

## Appearance settings update
- Added SQLite persistence for the selected Forest, Sunset, Monochrome or Night preset so the theme is restored after restarting the app.
- Added a custom palette editor for app background, card/surface, primary, accent, text, muted text and borders, with six-digit HEX validation and a live preview.
- Custom colors are stored locally in the existing settings table; no account, server or cloud service is used.
- Updated status-bar icon contrast for dark custom backgrounds.
- Build verification for this appearance change is pending.

## Lecture Files and Notepad build verification
- Lecture Files implementation commit `a1d2a0629e2647fb51f2d148f19c84ef888a77b9` built successfully in GitHub Actions run #25; `NewApk-debug` artifact uploaded (33,208,984 bytes; artifact ID `14505321647`).
- Notepad implementation commit `2e591349f856dc9538f82b4052fbe776608dadc8` built successfully in GitHub Actions run #26; `NewApk-debug` artifact uploaded (33,208,985 bytes; artifact ID `14505328496`).
- These results verify compilation and artifact upload only. Runtime file picking, external opening and persistent data still require emulator/device testing.

## Local reminder implementation
- Added native Android AlarmManager scheduling with a persistent local reminder queue.
- Added weekly recurring class reminders and one-time pending-task deadline and personal-activity reminders.
- Added configurable advance notice, system alarm sound, vibration, and notification-channel combinations; notifications use private lock-screen visibility with Snooze / Dismiss actions.
- Added rescheduling after device reboot, app replacement, time changes, time-zone changes and exact-alarm permission grants.
- Added permission/status controls in Settings. Enabling reminders requests notification permission first; exact alarms fall back to inexact allow-while-idle scheduling if exact-alarm access is not granted.
- Normal app refreshes now preserve pending snoozes; disabling all reminders clears them. Repeated snooze actions cancel the previous snooze alarm before replacing it.
- A pending task whose advance-notice time has passed but whose 8:00 AM deadline is still ahead now receives one immediate catch-up reminder.
- Reminder settings and event data remain on-device. Runtime notification delivery, snooze, reboot and device-specific battery behavior still require emulator/physical-device testing.
- The original reminder implementation passed GitHub Actions run #29 (commit `c989aad8c47518201e28ebdd934972e298b1a7bb`); the corrective changes here require a fresh build.


## Android home-screen widgets
- Added seven native Android home-screen widgets: Today&#39;s Classes, Weekly Schedule, Upcoming Tasks, Deadline Overview, Budget Overview, Savings Goals and Quick Expense.
- Widgets read NewApk's existing private SQLite database (read-only) and display the active saved theme preset or custom colors.
- A native refresh bridge updates installed widgets whenever the app reloads its SQLite records or the appearance changes.
- Added widget deep links into Schedule, Tasks and Budget. Quick Expense opens the Budget expense form directly.
- No backend or internet dependency is used. Installation, launcher rendering, resizing, live refresh and Quick Expense handoff still require emulator/physical-device testing.
- Android CI build verification for this widget implementation is pending.


## Widget build failure and correction
- GitHub Actions run #31 for commit `cef9c102efd420d3640dc04743cce9cd1830634e` failed at Android resource compilation (`:app:mergeDebugResources`).
- The log identified invalid Android string-resource parsing for apostrophes in the widget label and budget description; dependency installation succeeded, but no APK was produced.
- Reworded those two resources without apostrophes. The corrected widget build is pending.


- The first widget build failure was corrected by rewriting apostrophes in Android string resources; run #32 then passed resource merging.
- Run #32 for commit `d890723eedbb475648298305a8eb093f11a2967e` then failed at Kotlin compilation because public widget providers extended an internal base class. The base provider is now public; a new build is pending.


## Task editing, checklist and note linking
- Added an Edit Task flow that restores title, details, due date, priority and category, then updates the existing SQLite row instead of creating a duplicate.
- Added optional per-task checklists stored in SQLite JSON. Items can be checked directly from each task card, and completion states are preserved when the task is edited.
- Added optional task-to-Notepad linking. Linked note titles appear in task cards; deleting a linked note clears the task link safely.
- Added backward-compatible SQLite migrations for existing task rows. Existing tasks are retained and receive an empty checklist and no linked note.
- Build verification for this change is pending.

## Widget build verification
- GitHub Actions run #33 for commit `0ea7f91ed32e6fca59b4fb87b7cbe0af1be3a177` completed successfully. Android debug APK compilation and artifact upload passed.
- Artifact `NewApk-debug`: 33,237,646 bytes (artifact ID `14514373680`). CI confirms compilation and upload only; launcher and device interactions remain untested.

## Reminder build verification
- GitHub Actions run #30 for commit `f119dc4c0c1e254aec10753d58ac7aabb790dbdf` completed successfully. Android debug APK compilation and artifact upload passed.
- Runtime notification delivery, alarm tone, snooze/dismiss and reboot recovery still require emulator/physical-device testing.


## Budget transaction maintenance
- Added editing for existing income and expense entries, including title, amount, category and note.
- Added confirmation-based deletion. After either operation, Budget totals, category summaries and widgets refresh from SQLite.
- Existing custom transaction categories remain available in the edit form; the income/expense type is retained.
- Transaction update/delete build verification is pending.


## Offline JSON backup and restore
- Added Android document-provider actions to save a JSON backup to a user-selected location and pick an existing JSON backup for restore.
- Backup format `newapk-backup` version 1 includes subjects, classes, tasks and checklists, linked notes, activities, Budget transactions, monthly/category limits, savings goals and settings (appearance and reminder preferences).
- Restore validates the format, required tables, row shapes and record limits before opening a single SQLite transaction. It replaces the selected planner tables atomically and preserves primary IDs and relationships.
- Existing Lecture Files are not packaged because their private binary copies are device-local. Restore keeps those copies and clears their old subject associations to avoid linking them to unrelated restored subjects.
- Settings restore the saved appearance preset/custom colors; a full data refresh rebuilds reminders and installed widget contents.
- Backup/restore build verification is pending. Actual document-picker save and restore behavior requires emulator/physical-device testing.


## Budget reports and category-limit rollover
- Added a CSV export for the current month's Budget summary, category spending/limits, and transaction details using Android's user-selected document location.
- Added an optional setting to carry category spending limits into a new month. On refresh, the app copies the previous month's category limit amounts only for categories that do not already have a current-month limit.
- Existing current-month category limits are never overwritten. The rollover does not transfer cash, transaction totals, unspent amounts or savings balances.
- The rollover preference is saved in SQLite and is included in JSON backup/restore.
- Build verification for CSV export and rollover is pending; document-picker behavior requires device testing.


## APK artifact verification
- Downloaded and extracted the `NewApk-debug` artifact from run #33. The archive contains `app-debug.apk` (108,101,492 bytes).
- APK file identification succeeded, and DEX inspection confirmed all seven widget provider classes plus `PlannerWidgetsModule` are packaged.
- SHA-256: `ac722e39fa5d70dd0bdae246dc87639f7489b95746d7736f7beb5a4286a9c103`.
- This is static artifact inspection only; widget installation, launcher rendering, resizing, live refresh and deep-link interaction remain unverified on an emulator or physical device.

## Profile personalization
- Added an optional preferred-name setting stored in the existing local `settings` table. The name appears in the Home greeting and app avatar.
- Profile data is part of the existing JSON backup because it is stored in the settings table.
- Profile UI and persistence build verification are pending.


## CampusOS legacy backup migration
- Added a dedicated importer for CampusOS Backup JSON formats v1 and v2. It verifies that Homepage, Schedule, Tasks and Academics were all selected; partial exports are rejected before any NewApk records are changed.
- Converts subject IDs/codes, class days and times, Lecture/Lab types, professor/room details, tasks/deadlines/completion and subject-linked notes/favorites into the NewApk SQLite schema.
- Copies Base64 subject-file attachments into private NewApk Lecture Files storage (12 MB total decoded-data limit) and links files to their migrated subjects. Failed imports remove any newly copied files.
- Preserves NewApk Budget transactions, monthly/category limits, savings goals, personal activities, existing Lecture Files and app-only settings. CampusOS Backup v2 does not export Budget transactions or savings history.
- Compatible profile-name and appearance settings are mapped. CampusOS app-lock PINs, profile photos, home-layout configuration and detailed timetable appearance settings are not imported.
- Added Jest tests for data mapping, malformed JSON, partial backups, invalid timetable rows and attachment size limits. GitHub Actions now runs these tests before Android compilation.
- Profile personalization build #39 for commit `853710217046fa69ad0648dfc71dc8ccad5071e2` succeeded; the migration commit requires a fresh test and Android build result.


## Lecture File contents in NewApk backups
- NewApk JSON backup version 2 includes the actual Base64 contents of private Lecture Files, including their names, MIME types, categories and subject associations.
- Limits: 500 files and 12 MB total decoded attachment data. Missing files or over-limit backups fail before the JSON backup is saved.
- NewApk v2 restore imports attachments into private storage first, then replaces planner records and file metadata in one SQLite transaction. If the database restore fails, newly copied files are deleted; after success, previous file copies are removed.
- NewApk v1 backups remain supported and preserve existing on-device Lecture Files because those older backups contain only file metadata.
- CampusOS legacy imports continue to preserve existing NewApk Lecture Files while adding the imported CampusOS attachments.
- Android and backup-format verification for this change is pending.


## Standalone Android APK packaging correction
- Inspection of the run #41 debug artifact showed that it contains native DEX/resources but no `assets/index.android.bundle`. React Native debug variants intentionally rely on Metro, so this artifact is a development build and is not a standalone install target.
- Added a signed QA release variant using the generated Android debug key (not a production signing key) so the React Native release bundle is embedded and the APK can be installed without Metro.
- GitHub Actions now builds both the Metro-connected debug APK and the standalone QA APK, checks for the embedded JS bundle, verifies the APK signature with `apksigner`, and uploads them as separate artifacts.
- The standalone QA packaging change requires a new CI result. It is not a production-signed release.


## Standalone QA APK build diagnostics
- Run #42 passed the migration tests and built the Metro-connected debug APK. The standalone release JS bundle step then caught an invalid escaped slash regex in the widget deep-link handler at `App.js:450`.
- Replaced the unnecessary regex cleanup with direct URL route extraction; the native widget routes do not append a trailing slash.
- Release bundle, APK signature and standalone artifact verification are pending on the next workflow run.


## Storage panel and standalone QA APK verification
- Added a live Settings storage panel with SQLite page-allocation estimate, combined planner record count, and Lecture Files count/size. The database estimate uses SQLite page count × page size and explicitly warns that temporary journal files may not be included.
- Storage details refresh together with the existing local data refresh. Cleanup guidance recommends removing unneeded Lecture Files only after exporting a backup and warns that Android Clear storage / Clear data erases local planner data.
- GitHub Actions run #43 for commit `f55fefb4dcce9cc5754653ed13b7575f9ba42fd6` completed successfully. It built the debug and standalone QA APKs, verified the embedded React Native bundle and APK signature, and uploaded both artifacts.
- The storage-panel change in commit `258814c5951c352d73047392205a247eea62a4de` passed GitHub Actions run #44. Migration tests, debug and standalone builds, embedded-bundle verification, signature verification, artifact uploads and runner cleanup all succeeded.
- Downloaded standalone QA artifact `NewApk-standalone-qa` (artifact ID `14538210894`; ZIP artifact size 19,378,546 bytes). The extracted APK is 48,056,157 bytes; its React Native bundle is present at `assets/index.android.bundle` (985,048 bytes). Both the artifact ZIP and APK passed local archive-integrity checks.
- Standalone APK SHA-256: `717c9f29f724f4349013b3aa3e84a72d63fac4d8109764dd55e0fa748956aa25`.
- GitHub's `Verify standalone APK bundle and signature` step passed. This is a CI-signed QA build using the generated Android debug key, not a production-signed release. Emulator launch, data persistence and physical-device testing remain pending.


## Home dashboard weekly task and savings snapshots
- Added a weekly task snapshot showing the number of pending tasks due from today through the current week's Sunday, a separate overdue count, and navigation to Tasks.
- Added a savings snapshot showing total saved versus combined target, overall progress and the first two individual goals. It reads the existing local SQLite savings-goal records; no duplicate dashboard data is stored.
- The initial implementation passed migration tests, both APK builds, standalone bundle/signature checks and artifact upload in GitHub Actions run #46.
- Review found that overdue tasks were included in the initial due-this-week count and Sunday incorrectly extended the range into the next week. Corrected the date window to include today through the current Sunday only; overdue tasks now appear only in the overdue count.
- Corrected implementation commit `ca6fe0e6e204d62dc0e5714aef8a28c238b53978` passed all steps in GitHub Actions run #47, including migration tests, debug and standalone QA builds, embedded bundle/signature verification, both artifact uploads and runner cleanup.
- Downloaded standalone QA artifact `NewApk-standalone-qa` (artifact ID `14540598014`; ZIP size 19,380,182 bytes). ZIP archive integrity passed; extracted `app-release.apk` is 48,057,485 bytes, contains `classes.dex` and `assets/index.android.bundle` (988,076 bytes), and passed APK ZIP integrity inspection.
- Standalone QA APK SHA-256: `678895cdb2894c24f81fa045e846f668dc9a30d6033e1e73eb7d2390c76b7f53`.
- GitHub CI's signature verification passed. This remains a QA build signed with the generated Android debug key, not a production-signed release. Emulator launch and physical-device behavior remain unverified.


## Dashboard summary helper and regression tests
- Extracted pure Home dashboard calculations into `src/data/dashboardSummary.js`: pending task selection, due-today-through-Sunday counts, overdue task separation, calendar-date validation, combined savings totals and capped goal progress.
- Added Jest coverage for weekday and Sunday boundaries, completed tasks, overdue tasks, missing/invalid dates, combined savings totals, over-target progress and invalid goal amounts.
- The first test run (#49, commit `cfe0d55521f0f445240577745bce6a9004ce5ebf`) failed two task-date tests. The log identified an over-escaped date regex that rejected valid ISO date strings; the existing CampusOS migration suite passed.
- Corrected the regex in commit `f6ea2c88de5c94920a07e71b5645dddc46800670`. GitHub Actions run #50 passed all 10 tests, Android debug and standalone QA builds, bundle/signature verification, both artifact uploads and full runner cleanup.
- Downloaded standalone QA artifact `NewApk-standalone-qa` (artifact ID `14543302221`; ZIP size 19,381,069 bytes). The extracted APK is 48,058,325 bytes, contains `classes.dex` and `assets/index.android.bundle` (989,356 bytes), and passed APK ZIP integrity inspection.
- Standalone QA APK SHA-256: `7413a8c77c3b6926de561d86fd900f2e1845bd7a11a8f6f82c4e35258f0e98ef`.
- CI signature verification passed. It is a QA build signed with the generated Android debug key, not a production-signed release. Runtime and physical-device tests remain pending.


## Weekly Schedule grid and CI verification
- Changed Schedule's default presentation from a single-day list to a seven-day, horizontally scrollable timetable. Each weekday column shows its classes in start-time order, with time range, subject code/name, Lecture/Lab type and room.
- Tapping a day header or class opens the existing Day view for the selected weekday, where existing class removal and add-class/subject actions remain available. The Day view can be toggled back to Week view.
- GitHub Actions run #52 for commit `e384eb62d9a26ea5eb1f02421dc9a5bd2fc3e4ec` passed all unit tests, Android debug and standalone QA builds, embedded bundle and signature verification, both artifact uploads and runner cleanup.
- Downloaded standalone QA artifact `NewApk-standalone-qa` (artifact ID `14542593629`; ZIP size 19,382,676 bytes). ZIP and extracted APK archive integrity checks passed. APK size: 48,060,025 bytes; `classes.dex` and `assets/index.android.bundle` (992,588 bytes) are present.
- Standalone QA APK SHA-256: `065b2c42cb876232c6cdb515369cffd1e40ab3d761c8525d5a9c9bb08214d3a9`.
- CI signature verification passed. This is a QA-signed APK, not a production-signed release. Weekly grid rendering, scrolling, class taps and persistence have not been emulator- or device-tested.
