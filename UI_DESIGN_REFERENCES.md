# NewApk UI Design References

The following user-selected web UI references are the preferred visual direction for the corresponding NewApk modules. Treat them as layout and visual inspiration; implement original screens adapted to NewApk's offline-first requirements, data model, Android behavior, and CampusOS-inspired appearance system. Do not copy third-party assets or branding.

## Selected references

| NewApk module | Reference number | Reference concept | Source |
|---|---:|---|---|
| Home / Dashboard | 3 | Colorful student dashboard with greeting, subject cards, and schedule preview | https://storage.googleapis.com/dekrwsxnwyeihe/classroom-schedule-app.html |
| Schedule | 6 | Weekly timetable grid organized by weekdays and time | https://storage.googleapis.com/deumsxjeauplce/best-weekly-timetable-app.html |
| Tasks | 8 | Modern task manager with task cards, weekly tasks, and progress | https://dribbble.com/shots/23208396-Task-manager-app-UI-design |
| Budget | 9 | Simple budget interface with expense categories and remaining budget | https://dribbble.com/shots/21224536-Budget-mobile-app-for-Android |
| Notepad | 12 | Notes list organized with category controls | https://medium.com/@aysecavdar01/50-day-ui-design-challenge-56247e51fcc4 |
| Lecture Files | 14 | Document library with file categories, recent files, and previews | https://dribbble.com/tags/pdf-reader |
| Settings / Appearance | 16 | Appearance settings with wallpaper, app theme, and dark mode controls | https://alohabrowser.com/posts-customize-aloha-browser-on-android/ |

## Implementation guidance

- Keep the seven main modules: Home, Schedule, Tasks, Budget, Notepad, Lecture Files, and Settings.
- Preserve the user's chosen reference as the primary layout direction for each module.
- Use shared typography, spacing, cards, navigation, and component behavior across the app.
- Support Forest, Sunset, Monochrome, Night, and custom color combinations consistently across all screens.
- The Home dashboard must show live summaries from local module data.
- Schedule owns subject management; there is no standalone Academics module.
- Budget is a primary module.
- Keep core features offline with local SQLite storage; do not add a backend, account system, or cloud database.
- Implement functional states, forms, empty states, loading states, validation, and accessibility—not just static mockups.
- Treat the references as inspiration, not permission to reuse copyrighted artwork, brand assets, or proprietary UI assets.

## Status

Selections are confirmed by the user. They are documented as implementation targets; this does not mean all seven screens have already been implemented.
