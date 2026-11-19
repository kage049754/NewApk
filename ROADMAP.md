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
- [ ] Complete task editing, checklists, personal activities and task-note linking.
- [ ] Complete budget analytics, category limits and savings-goal tracking.
- [x] Add the offline lecture-file library, subject/category grouping, Android document picker, private file copies and external-app opening (CI/runtime verification pending).
- [ ] Implement complete dashboard aggregation and cross-module refresh.
- [ ] Implement alarms, local notifications and reminder scheduling.
- [ ] Implement Android home-screen widgets.
- [ ] Implement appearance persistence and all settings.
- [ ] Implement module-aware JSON backup/export and validated restore/import.
- [ ] Add migration support for existing CampusOS JSON backups where compatible.
- [ ] Add automated unit and UI tests.
- [ ] Verify emulator launch, persistence, navigation and notification behavior.
- [ ] Prepare release APK and document physical-device testing separately.
