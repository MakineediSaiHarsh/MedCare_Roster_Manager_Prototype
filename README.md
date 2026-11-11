# MedCare Roster Workspace

A two-role prototype built with HTML, CSS, and JavaScript. All practice, plan, and roster data are synthetic.

## Run the demo

Open `index.html` in a browser.

1. As the **Practice administrator**, select **Sync sample CSV**. The demo compares two embedded CSV versions and shows three changes.
2. Select **Approve & submit selected (2)**. The phone and location changes go to Summit Health Plan as one batch. The missing roster row stays held for review.
3. Switch to **Plan analyst** and open the Cedar Grove Medical batch in the review queue. Select **Approve ready (1)**.
4. In **Practice location**, select **Escalate** and send it to **Network Operations**. Then select **Simulate posting (1)** to confirm the phone update.
5. Switch back to **Practice administrator**. Submission history shows the phone update as **Posted** and the location change as **Under review**. Expand **Audit log** to see the decisions.

The analyst can also request clarification. For the Cedar Grove batch, the practice can reply from its submission history. **Reset demo** restores the initial scenario. Changes are stored in the current browser when local storage is available. Role switching, roster sync, escalation routing, and downstream posting are simulated in that browser.

## Publish on GitHub Pages

1. Extract the ZIP and add its files to the root of a public GitHub repository on the `main` branch.
2. Open **Settings → Pages** and choose **Deploy from a branch** under **Source**. Select **main** and **/(root)**, then save.
3. When deployment finishes, open **Visit site** in Pages. Verify that it opens in an incognito window, then use that URL in your deck.

[GitHub Pages publishing instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
