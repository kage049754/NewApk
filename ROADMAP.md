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
- [ ] Complete remaining dashboard summary refinements.
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
- [ ] Add automated unit and UI tests.
- [ ] Verify emulator launch, persistence, navigation and notification behavior.
- [ ] Prepare release APK and document physical-device testing separately.


## APK packaging
- [x] Add a standalone QA APK with an embedded React Native bundle and CI signature verification.
- [ ] Prepare the production-signed release APK.
