# Home Manager Desktop

Local-first Electron desktop app for home management: tasks, property, inventory, utilities, contacts, checklists, and gamification with a smart dashboard. All data stays on the device in a JSON file for privacy.
<img width="1194" height="795" alt="Screenshot 2026-01-03 at 3 57 12" src="https://github.com/user-attachments/assets/2f9ea2f8-ae37-4e3a-9035-f1c640c344b0" />

## Features

- Property and rooms management
- Inventory tracking with warranty dates and statuses
- Utilities meters with history and reminders
- Contacts and checklists
- Tasks, routines, goals, maintenance, documents
- Gamification (XP, levels, achievements)
- Smart dashboard with widgets and quick actions

## Tech stack

- Electron 31.x
- Vanilla JS, HTML, CSS
- Local JSON storage

## Project structure

```
electron/   # main process, preload, IPC, storage
src/        # renderer app, views, styles
```

## Quick start

1) Install Node.js LTS (18 or 20).
2) In the project folder:
```bash
npm i
npm start
```

## Build

```bash
npm run build:mac
npm run build:win
```

## Data storage

Electron userData folder:
- `data/db.json` - database
- `data/attachments/` - attachments
- `data/backups/` - automatic backups

Open it via **App → Open data folder**.

## Docs

- `QUICKSTART.md`
- `DOCS_INDEX.md`
- `PROJECT_CONTEXT.md`
- `CHANGELOG.md`
- `EXPERT_RECOMMENDATIONS.md`

## License

MIT
