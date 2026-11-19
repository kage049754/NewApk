# NewApk Roadmap

## Product rules
- Independent React Native rewrite; never modify CampusOS.
- Offline-first: no backend, cloud database, sign-in, or network dependency for core planner data.
- Excluded: attendance, calculator, study timer/Pomodoro, date calculator, unit converter, grade calculator, IT/CS utilities, exam reminders, student registration/login, announcements, group chat, group creation, group leadership, member search, online administration, invitation links/QR, admin approval, announcement images.
- CampusOS-inspired Forest, Sunset, Monochrome and customizable appearance.

## Milestones
- [x] Inspect CampusOS source repository and document feature scope.
- [x] Create initial React Native Android project foundation.
- [x] Add SQLite schema for subjects, classes, tasks, notes, activities and settings.
- [x] Add initial dashboard, local list creation and appearance selector.
- [ ] Verify first GitHub Actions build and fix all build failures.
- [ ] Complete schedule CRUD, weekly timetable and conflict detection.
- [ ] Complete tasks, personal activities, notes and subject linking.
- [ ] Implement lecture file import and offline viewing.
- [ ] Implement complete dashboard aggregation and cross-module refresh.
- [ ] Implement alarms, local notifications and reminder scheduling.
- [ ] Implement Android home-screen widgets.
- [ ] Implement appearance persistence and all settings.
- [ ] Implement module-aware JSON backup/export and validated restore/import.
- [ ] Add migration support for existing CampusOS JSON backups where compatible.
- [ ] Add automated unit and UI tests.
- [ ] Verify emulator launch, persistence, navigation and notification behavior.
- [ ] Prepare release APK and document physical-device testing separately.
