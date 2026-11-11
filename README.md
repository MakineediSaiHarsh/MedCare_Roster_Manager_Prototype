# MedCare Roster Workspace

Practice administrators already maintain a master roster. Sending updates to a health plan can mean reformatting the file and following up to see what posted. On the plan side, analysts have to work out what changed across submissions and decide what they can safely apply.

MedCare compares the practice’s latest CSV with its last confirmed roster. The practice administrator selects the intended changes and sends them together. The plan analyst sees batches from multiple practices in one queue, approves routine updates, and routes individual exceptions to the right team.

## Walk through the demo

Open the published GitHub Pages site, or open `index.html` locally in a browser. If the demo has already been used, click **Reset demo** to start fresh.

1. **Find the changes.** In **Practice administrator**, click **Sync sample CSV**. Two CSV versions produce three changes. The phone and location updates are selected. The missing roster row is held for review so the practice can verify the omission in its source roster.
2. **Send one batch.** Click **Approve & submit selected (2)**. This confirms the practice’s intent and sends both changes to Summit Health Plan.
3. **Make the plan decision.** Switch to **Plan analyst** and open the **Cedar Grove Medical** batch. Compare the current plan values with the practice-confirmed updates. Click **Approve ready (1)** for the phone change. On the location change, click **Escalate** and assign it to **Network Operations** to verify participation at the new site. Click **Simulate posting (1)** to confirm the phone update.
4. **Check what happened.** Switch back to **Practice administrator**. In **Submission history**, the phone change shows **Posted** and the location change shows **Under review**. Open the **Audit log** to see who acted and when.

The analyst can also **Request clarification** on a change. For the Cedar Grove batch, the practice administrator can respond directly from **Submission history**.

## What a pilot would test

Measure time spent per completed update for practice admins and plan analysts, time to confirmed posting, and posting accuracy against the current workflow. Track whether practices choose MedCare again on their next eligible update.

## Prototype setup

The demo uses synthetic data and runs entirely in the browser with HTML, CSS, and JavaScript. CSV sync and plan posting are simulated. Demo progress is saved in the current browser. ChatGPT assisted with prototype code and documentation.
