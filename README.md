# SPMS — Student Project Management System

Web-based academic project management for students, project leaders, advisers, and administrators.

## Features (from proposal)

- **Account & Authentication** — login, roles (Student, Project Leader, Adviser, Admin)
- **Project Management** — create/manage projects, members
- **Task Management** — assign, track status, complete tasks
- **Workload Monitoring** — compare assigned load among members
- **Contribution Tracking** — completed tasks, assigned work, files, and recorded project activity
- **Deadline Monitoring** — upcoming deadlines list
- **File Management** — shared Firestore uploads and downloads, with a 500 KiB per-file limit
- **Adviser Monitoring** — progress updates and persisted feedback
- **Administration** — account access, role management, academic settings, registration control, and audit history
- **RBAC** — role-aware routes, data queries, and Firebase security rules

## UI/UX

Responsive SPMS dashboard with project and task summaries, workload, upcoming deadlines, and recent activity.

## Role workflows

- **Student:** open assigned projects and tasks, update task status, check deadlines and contribution records, and upload project files.
- **Project Leader:** create projects, add student members, assign advisers, create dated tasks, and review workload and participation.
- **Instructor / Adviser:** open assigned projects, monitor progress, review participation and project files, and leave persistent feedback.
- **Administrator:** manage roles and account access, configure the academic period and registration availability, and review audit records.

## Stack

- Angular 19 (standalone components, signals)
- TypeScript
- Firebase Authentication
- Cloud Firestore
- IndexedDB for accessing and migrating older browser-local uploads
- SCSS

## Firebase setup

1. In Firebase Console, enable Email/Password Authentication and create a Firestore database.
2. Deploy the included Firestore rules from this directory with `firebase deploy --only firestore:rules`.
3. The web app client configuration is in `src/app/core/firebase.config.ts`. Firebase web API keys are public identifiers; secure access with the deployed rules.
4. New registrations receive the Student role. To bootstrap the first administrator, create an account, then set `role` to `admin` in both `users/{uid}` and `teamDirectory/{uid}` in Firestore. Keep `isActive` set to `true`.

Projects, tasks, profiles, directory entries, activities, system settings, and audit records are stored in Firestore. Profile photos are resized and stored in the user's Firestore profile. Project file metadata and contents are stored in Firestore, and authorized members of the project can view and download them. Each file is limited to 500 KiB; uploads and downloads use Firestore quota. Older files saved in a browser's IndexedDB remain available to that account on that browser and can be shared from the File Management page if they are within the size limit. No Firebase Storage bucket is used.

The Firebase CLI must be signed into an account that can access the configured project (`spms-914c4`) before deploying Firestore rules.

## Run

```bash
npm install
npm start
```

Open http://localhost:4200 and register or sign in with a Firebase account.

## Structure

```
src/app/
  core/          models, auth, data services, guards
  layout/        shell (sidebar + topbar)
  features/
    auth/        login
    dashboard/   main dashboard (matches UI)
    projects/    project list + create
    tasks/       task table
    workload/    workload cards
    contributions/
    deadlines/
    files/
    adviser/
    admin/
```
