# Attention Reset

An everyday iPhone home-screen tracker with a simple monthly calendar. No server, extra account, or notification setup.

## Two daily goals

- Complete one **20-minute focus session**. Use the built-in timer or mark the checkbox after a session you timed another way.
- Keep short-form video use **strictly below 60 minutes** for the day. Enter your actual total; **60 minutes does not meet this goal**. A blank entry is unrecorded, not zero.

A day turns green only when both goals are met. The phone-away checkbox and thought-capture controls have been removed. Older saved entries and any legacy fields remain in your downloadable record.

## Monthly progress

The app opens to the current month and today's checklist. Use the January–December tabs, the previous/next arrows, or swipe left and right on the calendar to browse history. The year selector lets you revisit earlier years. Upcoming months and days cannot be edited.

Tap a past day to view or correct its checklist. Green means both goals are met; a light green square with a dot means one goal is met. Today has a blue outline. The selected day has an additional outline.

The three statistics apply to the month you're viewing:

- **Best streak:** longest consecutive run of completed days within that month. A missed day does not erase that record.
- **Days done:** days with both goals completed.
- **Completion:** completed days divided by tracked calendar days from your tracking start through today. Future days and days before you started are excluded. A month with no tracked days displays a dash.

The app continues month after month and year after year. There is no seven-day cutoff.

## Timer and gentle restarts

The timer uses a saved deadline so it keeps time when you switch away or reload. It is silent and does not send an alarm or notification. When it finishes, confirm that you completed 20 minutes; the app does not mark the focus goal automatically. A session stays attached to the day it started, even if you browse another month.

After a slip, take a two-minute restart. That records a small return and opens a two-minute timer; it does not count as a completed 20-minute session or erase earlier progress.

## Publish with GitHub Pages

1. Open [Pages settings](https://github.com/dustinsagurosyt/Personal/settings/pages).
2. Choose **Deploy from a branch**, then **main** and **/(root)**.
3. Click **Save** and wait for GitHub to show the published address.

Expected address after publication: https://dustinsagurosyt.github.io/Personal/

If Pages is already enabled, changes to `main` publish through the existing Pages build. There is no build command or dependency installation.

## Add to iPhone

Open the published address in Safari, tap **Share → Add to Home Screen**, turn on **Open as Web App** if shown, then tap **Add**. Open it from its home-screen icon each day.

## Your data

Progress saves in the same `attention-reset-v1` browser record used by the previous version, so an update at the same app address keeps your history. Records do not transfer between different app addresses, devices, or browsers. Clearing browser data removes them. Use **Download my record** for a JSON backup.

Your entries are not uploaded to GitHub. The published app has a public address; your records stay on your device. If storage is unavailable, the app shows a saving warning. If a previous record cannot be read, saving pauses to protect it and the download button exports the original data.

## Checks

With Node.js available, run:

```sh
node --test tests/*.test.mjs
```

These checks cover the strict video limit, monthly history, leap years, old saved records, tab/swipe navigation, timer persistence, session dates, and two-minute restarts. No installation is needed to run the checks.
