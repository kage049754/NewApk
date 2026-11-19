# NewApk

An offline-first Android student productivity app rebuilt from the selected CampusOS feature set using **React Native and JavaScript**.

## Project direction

NewApk is an independent project. The original CampusOS repository is a reference only and will not be modified.

### Included modules
- Home dashboard
- Class schedule and subject management
- Budget (income, expenses, categories and monthly spending limits)
- Subject management inside Schedule
- Subject-linked Notepad
- Lecture Files
- Tasks and personal activities
- Local reminders, alarms and vibration
- Android home-screen widgets
- Appearance presets and custom color combinations (saved locally)
- Settings, local JSON backup and restore

### Explicitly excluded
Attendance, calculator, study timer/Pomodoro, date calculator, unit converter, grade calculator, IT/CS utilities, exam reminders, all campus accounts and online/social administration features (registration/login, approvals, announcements, groups, group chat, group leadership, member search, invitations and QR group joining).

## Technology
- React Native 0.76
- JavaScript
- SQLite on-device storage
- Native Android integration for alarms, notifications and widgets
- GitHub Actions for Android builds

No backend, cloud database, account system, or internet connection is required for core functionality.

## Development status
See [ROADMAP.md](ROADMAP.md) and [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

The initial React Native foundation is being established. A successful CI build and APK artifact are required before the project can be called build-verified.
