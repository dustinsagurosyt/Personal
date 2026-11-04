# Attention Reset

An everyday iPhone home-screen tracker with a monthly calendar and a one-minute gratitude journal. No server, extra account, or notification setup.

## Two daily goals

- **One-minute gratitude:** tap **Write** to open a circular one-minute timer and a writing space. On today’s first session the timer starts automatically. Write what you’re grateful for; the entry saves on this device as you type. Tap the checkmark to save and complete the goal. You can finish early when your entry is ready, or mark an existing written entry complete from the checklist. Empty or whitespace-only entries cannot count as complete.
- **Short videos under 60 minutes:** enter the whole day’s total. The limit is strictly below 60; 60 minutes does not meet this goal. Blank is unrecorded, not zero. The app does not measure or block other apps.

A day turns green when both goals are met.

## Gratitude timer

The writing screen has a soft circular progress face, a one-minute countdown, pause/resume, a central finish checkmark, reset, and close controls.

- Closing the screen keeps your draft and does not stop a running timer.
- Resetting the timer keeps your writing.
- A saved deadline keeps elapsed time through backgrounding and reloads. The timer is silent; it does not send an alarm or notification.
- When the minute ends, your entry is not automatically marked complete. Use the checkmark when the writing is ready.
- Entries are saved for the date you opened. Browsing a different month or passing midnight does not move an entry to another day.
- If a timer is running for another day, you can read or write a different entry without replacing it; use **Return to active session** to go back.

## History and earlier focus records

The app opens to the current month and today’s checklist. The month strip shows the viewed month, the two before it, and the month after it. Browse using the tabs, arrows, or left/right swipes on the month strip or calendar. You can preview the upcoming month without editing its dates. Weeks begin on Sunday. The year selector shows earlier years. Upcoming days cannot be edited.

Tap a past day to read or edit its record. Green means both goals are met, light green with a dot means one goal is met, and today has a blue outline. The statistics show that month’s best streak, days completed, and completion rate. Future days and days before tracking began are excluded from the rate.

The one-minute journal replaces the 20-minute focus goal from the day this update is first opened. Older focus-session achievements stay in history and appear as **Previous focus session** when you view those days. They are not presented as newly written gratitude entries. Earlier saved fields are retained in your backup. Old 20-minute timers are not reused as one-minute timers.

## Publish and install

Publish the repository with GitHub Pages: **Settings → Pages → Deploy from a branch → main → /(root) → Save**. If Pages is already enabled, changes to `main` publish through its existing build. No build command or dependency installation is required.

Expected published address: https://dustinsagurosyt.github.io/Personal/

Open that address in iPhone Safari, then **Share → Add to Home Screen → Open as Web App** if shown, then **Add**.

## Your data

Entries use the same `attention-reset-v1` browser record as the previous version, so updates at the same app address keep history. A separate timer record stores the running gratitude session. Your gratitude writing, video totals, and progress stay in this browser on this device; they are not sent to GitHub or another service. Clearing browser data removes them. Use **Download my record** for a JSON backup.

Records do not automatically transfer between devices, browsers, or app addresses. Saving errors appear in the app. If a previous record cannot be read, saving pauses to protect it, and downloading exports the original stored record.

## Checks

With Node.js available:

```sh
node --test tests/*.test.mjs
```

Checks cover writing persistence, blank-entry validation, timer pause/resume/reset/reload, date ownership, historical focus records, Sunday-first months, leap years, and the strict video limit.
