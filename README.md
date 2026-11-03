# Attention Reset

A small iPhone home-screen app for a little more focus: a 60-minute short-video target, a phone-free 20-minute focus session, thought capture, a two-minute check-in, seven-day progress, and a gentle restart button.

Includes direct iPhone push notifications. No Google Calendar, ChatGPT account, Apple developer membership, or App Store submission is required for this exported version.

## Download your code

Your source code is in [dustinsagurosyt/Personal](https://github.com/dustinsagurosyt/Personal).

On the repository page, click **Code → Download ZIP**, then unzip it on your computer. Open a terminal inside the extracted project folder and follow the setup below.

## Make it run with app notifications

GitHub stores your code. Cloudflare Workers hosts the app and sends reminders when it is closed. GitHub Pages alone cannot run this notification server or its schedule.

You need a Cloudflare account on the **Workers Free** plan and Node.js 22 or newer on a computer. This app is sized for personal use within published free quotas; free plans have usage limits, and service terms can change. No paid upgrade is required by this code.

Open a terminal inside the downloaded project folder and run:

```sh
npm install
npm run setup
```

Setup asks for a contact email used by Apple's push service, opens Cloudflare sign-in, creates a small storage namespace, deploys the app, and generates notification signing keys. Private keys go directly to Cloudflare secrets; the script does not save them to a file or print them. It preserves existing keys when you rerun setup.

Use the `workers.dev` URL printed during setup. Setup updates `wrangler.json` with your storage namespace ID: commit that updated file to GitHub. The ID is configuration, not a password.

For later code changes, download or pull the updated repository, then run:

```sh
npm install
npm run deploy
```

If you already have a Worker named `attention-reset` that you do not want to update, change `name` in `wrangler.json` before running setup. You do not need a custom domain.

## Add it to your iPhone

1. Open your new Cloudflare URL in Safari.
2. Share → Add to Home Screen → enable **Open as Web App** if shown → Add.
3. Open it from the new home-screen icon.
4. Tap **Enable notifications**, then Apple's **Allow** button.
5. A test alert is sent. If storage is still updating, wait about a minute and tap **Send a test alert**.

Requires iOS 16.4 or later. Alerts can arrive while the app is closed. iPhone Focus modes and notification settings can silence or delay them. The timer is silent; it does not promise a background timer alarm.

## Your reminder schedule

- 9 am: choose one task, park the phone, focus for 20 minutes.
- 8:30 pm: record video minutes, save a thought, choose one next step.
- Time zone: America/Los_Angeles. Daylight-saving changes are handled automatically.
- Existing exceptions: November 6 and 9, 2026 begin at 9:05 am. Remove `FOCUS_OVERRIDES` from `wrangler.json` if you do not need those exceptions.
- Each device receives seven days of reminders beginning when it first enables them. Reopening the app does not restart the seven days. After the week, turn reminders off and on to start another reminder week; your progress stays.

The UTC cron rules in `wrangler.json` cover both Pacific standard and daylight time. If you change the local reminder times or time zone, update the UTC cron rules too. Cloudflare says cron changes can take up to 15 minutes to propagate.

## What is stored

- Your thoughts, task, video minutes, and check-ins stay in that browser on that device. They do not sync or get sent with notifications. Clearing browser data removes them. Use **Download my record** for a backup.
- The server stores each opted-in device's push address, browser push keys, reminder dates, and delivery receipts. **Turn reminders off** removes that device's server subscription.
- This standalone deployment has a public app address, without account sign-in. There is no public route to list subscriptions or send reminders to everyone. Visitors can only enroll a device using its browser-generated subscription details. Personal notes remain local.
- Existing records from the ChatGPT-hosted app do not move automatically to your new address. Download your old record before switching if you want to keep a copy.

No credentials from the original ChatGPT-hosted app are included. Notification keys must remain the same for installed devices; setup does not silently replace them on reruns.

## Files

- `public/index.html`, `style.css`, `app.js`: daily tracker and seven-day starter plan.
- `public/notifications.js`, `sw.js`, `manifest.webmanifest`: home-screen installation and push handling.
- `src/worker.js`: device enrollment, test alerts, and scheduled notification delivery.
- `wrangler.json`: hosting, storage binding, and reminder schedules.
- `scripts/setup.mjs`: one-time deployment and private key setup.
- `scripts/write-icons.mjs`: regenerates the app icons when copying the text files manually.

## Verification

```sh
npm test
npm run check
```

The export passed the reminder behavior tests and a local deployment build. It has not been deployed to your Cloudflare account or tested on your iPhone; run setup and confirm the test alert before relying on reminders.

Cloudflare KV may take about a minute to reflect a new subscription globally. Delivery receipts suppress ordinary repeat sends; KV is eventually consistent, so the notification tag also helps group retries. Push delivery is best effort.

## Reference documentation

- [Cloudflare static assets](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Cloudflare cron triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Cloudflare Workers KV free quotas](https://developers.cloudflare.com/kv/platform/pricing/)
- [iPhone home-screen Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

If you switch to this deployment, turn notifications off inside the old home-screen app to avoid receiving reminders from both copies.
