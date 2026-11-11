"use strict";

const ICONS = {
  practice: '<path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-4h6v4M9 10h.01M15 10h.01M9 13h.01M15 13h.01"/>',
  plan: '<path d="M4 5h16v14H4zM4 10h16M9 10v9"/>',
  file: '<path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10zM13 3v7h7M8 14h8M8 17h8"/>',
  sync: '<path d="M20 7v5h-5M4 17v-5h5M4.8 8a8 8 0 0 1 13-2L20 8M4 16l2.2 2a8 8 0 0 0 13-2"/>',
  diff: '<path d="M5 7h14M5 17h14M10 3v8M14 13v8"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  flag: '<path d="M4 22V3m0 2c6-5 10 5 16 0v11c-6 5-10-5-16 0"/>',
  history: '<path d="M3 12a9 9 0 1 1 3 6.7M3 7v5h5m4-5v5l3 2"/>',
  arrow: '<path d="m9 18 6-6-6-6"/>',
  send: '<path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>'
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const PRACTICE = "Cedar Grove Medical";
const PROVIDER = "Alex Morgan";
const PLAN = "Summit Health Plan";
const ANALYST = "Taylor Chen";
const STORAGE_KEY = "medcare-roster-workspace-v1";
const BASE_CSV = `provider_id,provider_name,location,phone
CG-101,Dr. Nina Patel,North Clinic,202-555-0101
CG-102,Dr. Owen Reyes,North Clinic,202-555-0102
CG-103,Dr. Lena Shah,East Clinic,202-555-0103
CG-104,Dr. Jordan Kim,East Clinic,202-555-0104`;
const UPDATED_CSV = `provider_id,provider_name,location,phone
CG-101,Dr. Nina Patel,North Clinic,202-555-0142
CG-102,Dr. Owen Reyes,West Clinic,202-555-0102
CG-104,Dr. Jordan Kim,East Clinic,202-555-0104`;

const FIELD_LABELS = { phone: "Scheduling phone", location: "Practice location", row: "Roster row" };
const STATUS = {
  submitted: ["Submitted", "blue"],
  approved: ["Approved", "blue"],
  escalated: ["Under review", "purple"],
  clarification: ["Clarification requested", "amber"],
  posted: ["Posted", "green"]
};

function readDemoCsv(csv) {
  // The embedded fixture uses plain, comma-free field values.
  return new Map(csv.trim().split(/\r?\n/).slice(1).map((line) => {
    const [id, name, location, phone] = line.split(",");
    return [id, { id, name, location, phone }];
  }));
}

function compareRosters() {
  const baseline = readDemoCsv(BASE_CSV);
  const latest = readDemoCsv(UPDATED_CSV);
  const changes = [];
  for (const [id, record] of baseline) {
    const next = latest.get(id);
    if (!next) {
      changes.push({ id: id + "-row", providerId: id, name: record.name, field: "row", before: "On roster", after: "Missing from CSV" });
      continue;
    }
    for (const field of ["phone", "location"]) {
      if (record[field] !== next[field]) {
        changes.push({ id: id + "-" + field, providerId: id, name: record.name, field, before: record[field], after: next[field] });
      }
    }
  }
  return changes;
}

function activity(actor, label, note = "", time = new Date().toISOString()) {
  return { actor, label, note, time };
}

function initialState() {
  const examples = [
    { id: "RB-104", practice: "Brookfield Primary Care", by: "Jamie Brooks", providerId: "BP-201", name: "Dr. Eva Green", field: "phone", before: "202-555-0111", after: "202-555-0155", hours: 2 },
    { id: "RB-103", practice: "Pine Valley Health", by: "Sam River", providerId: "PV-301", name: "Dr. Noah Reed", field: "location", before: "Pine Valley Main", after: "Pine Valley South", hours: 22 }
  ];
  const records = Object.fromEntries(readDemoCsv(BASE_CSV));
  const batches = examples.map((example) => {
    const { id, practice, by, providerId, name, field, before, after, hours } = example;
    const time = new Date(Date.now() - hours * 3600000).toISOString();
    records[providerId] = { [field]: before };
    return { id, practice, by, time, changes: [
      { id: providerId + "-" + field, providerId, name, field, before, after, status: "submitted", audit: [activity(by, "Submitted", "", time)] }
    ] };
  });
  return { synced: false, nextBatch: 105, records, batches };
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // The workflow is still available in memory when storage is unavailable.
  }
  return initialState();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The workflow is still available in memory when storage is unavailable.
  }
}

const main = document.querySelector("main");
const dialog = document.querySelector("#action-dialog");
const form = document.querySelector("#action-form");
const toast = document.querySelector("#toast");
const allDrafts = compareRosters();
const selected = new Set();
const auditsOpen = new Set();
let state = loadState();
let role = "provider";
let activeBatchId = null;
let queueFilter = "all";
let practiceFilter = "all";
let dialogAction = null;
let toastTimer;

document.querySelector("#provider-role").innerHTML = icon("practice") + " Practice administrator";
document.querySelector("#plan-role").innerHTML = icon("plan") + " Plan analyst";
document.querySelector(".reset").innerHTML = icon("history") + " Reset demo";
dialog.querySelector(".icon-button").innerHTML = icon("close");

function providerBatches() {
  return state.batches.filter((batch) => batch.practice === PRACTICE);
}

function drafts() {
  const submittedIds = new Set(providerBatches().flatMap((batch) => batch.changes.map((change) => change.id)));
  return state.synced ? allDrafts.filter((change) => !submittedIds.has(change.id)) : [];
}

function planValue(change) {
  return state.records[change.providerId]?.[change.field] ?? "No matching plan value";
}

function reviewFlag(change) {
  if (change.status !== "posted" && planValue(change) !== change.before) {
    return "The current plan value differs from the practice’s previous value.";
  }
  if (change.field === "location") return "Network Operations must verify participation at the new location.";
  return "";
}

function readyToApprove(change) {
  return change.status === "submitted" && !reviewFlag(change);
}

function hasOpenException(change) {
  return change.status === "escalated" || change.status === "clarification" ||
    (change.status === "submitted" && Boolean(reviewFlag(change)));
}

function batchStatus(batch) {
  if (batch.changes.every((change) => change.status === "posted")) return ["Posted", "green"];
  if (batch.changes.some((change) => change.status === "posted")) return ["Partially posted", "blue"];
  if (batch.changes.some((change) => change.status === "clarification")) return ["Awaiting clarification", "amber"];
  if (batch.changes.some((change) => change.status === "escalated")) return ["Under review", "purple"];
  if (batch.changes.some((change) => change.status === "approved")) return ["Awaiting posting", "blue"];
  if (batch.changes.some(reviewFlag)) return ["Needs review", "amber"];
  return ["Ready for approval", "blue"];
}

function timeLabel(time) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(time));
}

function notice(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toastTimer = setTimeout(() => { toast.textContent = ""; }, 5000);
}

function badge([label, tone]) {
  return `<span class="badge ${tone || ""}">${escapeHtml(label)}</span>`;
}

function button(label, action, { value = "", glyph, style = "secondary", disabled = false, id = "" } = {}) {
  return `<button type="button" class="button ${style}" data-action="${action}"${value ? ` data-value="${escapeHtml(value)}"` : ""}${id ? ` id="${id}"` : ""}${disabled ? " disabled" : ""}>${glyph ? icon(glyph) : ""}${escapeHtml(label)}</button>`;
}

function topbar(section, name, initials) {
  return `<header class="topbar"><div class="topbar-inner">
    <div class="breadcrumb">Workspace ${icon("arrow")} <strong>${section}</strong></div>
    <div class="profile"><span class="avatar" aria-hidden="true">${initials}</span><span class="name">${name}</span></div>
  </div></header>`;
}

function heading(glyph, org, title, description) {
  return `<header class="page-heading">
    <div class="eyebrow">${icon(glyph)} ${org}</div>
    <h1 id="page-title" tabindex="-1">${title}</h1>
    <p>${description}</p>
  </header>`;
}

function stat(glyph, number, label, tone = "") {
  return `<div class="stat"><div class="stat-icon ${tone}">${icon(glyph)}</div>
    <div><div class="stat-number">${number}</div><div class="stat-label">${label}</div></div></div>`;
}

function empty(glyph, title, detail) {
  return `<div class="empty"><div class="empty-icon">${icon(glyph)}</div><div><h3>${title}</h3><p>${detail}</p></div></div>`;
}

function renderDraftTable(changes) {
  if (!state.synced) return empty("diff", "Ready to compare roster versions", "Sync the sample CSV to see changes against the last confirmed roster.");
  if (!changes.length) return empty("check", "No changes waiting for review", "Open submission history to track the changes sent to the plan.");
  const rows = changes.map((change) => {
    const held = change.field === "row";
    const status = held ? ["Held for review", "amber"] : change.field === "location" ? ["Plan review required", "amber"] : ["Ready to submit", "green"];
    return `<tr><td class="check-cell">${held
      ? '<span aria-hidden="true">—</span>'
      : `<input type="checkbox" data-select="${change.id}" aria-label="Select ${FIELD_LABELS[change.field]} for ${escapeHtml(change.name)}" ${selected.has(change.id) ? "checked" : ""}>`}</td>
      <td><strong>${escapeHtml(change.name)}</strong><span class="meta">${change.providerId}</span></td>
      <td>${FIELD_LABELS[change.field]}</td>
      <td><span class="before">${escapeHtml(change.before)}</span></td>
      <td><span class="${held ? "before" : "after"}">${escapeHtml(change.after)}</span></td>
      <td>${badge(status)}${held ? '<span class="meta">Verify the omission in the source roster.</span>' : ""}</td></tr>`;
  }).join("");
  return `<div class="table-scroll" tabindex="0" role="region" aria-label="Detected roster changes">
    <table class="roster-table"><thead><tr><th scope="col"><span class="sr-only">Select</span></th><th scope="col">Provider</th><th scope="col">Field</th><th scope="col">Previous roster</th><th scope="col">Latest CSV</th><th scope="col">Review</th></tr></thead>
    <tbody>${rows}</tbody></table></div>
    <div class="panel-footer"><p id="selection-summary" aria-live="polite">${selected.size} selected for submission</p>
    ${button("Approve & submit selected (" + selected.size + ")", "submit", { glyph: "send", style: "primary", id: "submit-batch", disabled: !selected.size })}</div>`;
}

function auditLog(batch) {
  const entries = batch.changes.flatMap((change) => change.audit.map((entry) => ({ ...entry, field: FIELD_LABELS[change.field] })));
  entries.sort((first, second) => second.time.localeCompare(first.time));
  return `<details class="audit" data-audit="${role + "-" + batch.id}" ${auditsOpen.has(role + "-" + batch.id) ? "open" : ""}>
    <summary>Audit log (${entries.length})</summary><ul>${entries.map((entry) => `<li>
    <time datetime="${entry.time}">${timeLabel(entry.time)}</time><span>${escapeHtml(entry.actor)} · ${escapeHtml(entry.label)} · ${entry.field}</span>
    ${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ""}</li>`).join("")}</ul></details>`;
}

function renderProviderHistory(batches) {
  if (!batches.length) return empty("history", "No batches submitted yet", "After submission, each change’s status will appear here.");
  return batches.map((batch) => `<div class="batch-block">
    <div class="batch-title"><div><h3>${batch.id}</h3><p>Sent to ${PLAN} by ${batch.by} · ${timeLabel(batch.time)}</p></div>${badge(batchStatus(batch))}</div>
    <div class="table-scroll" tabindex="0" role="region" aria-label="Changes in ${batch.id}">
    <table class="roster-table"><thead><tr><th scope="col">Provider</th><th scope="col">Change sent</th><th scope="col">Plan status</th><th scope="col">Latest update</th></tr></thead>
    <tbody>${batch.changes.map((change) => {
      const latest = change.audit.at(-1);
      const reply = change.status === "clarification" ? button("Reply to analyst", "reply", { value: batch.id + "/" + change.id, style: "text small" }) : "";
      return `<tr><td><strong>${escapeHtml(change.name)}</strong><span class="meta">${change.providerId}</span></td>
        <td>${FIELD_LABELS[change.field]}<span class="meta">${escapeHtml(change.before)} → ${escapeHtml(change.after)}</span></td>
        <td>${badge(STATUS[change.status])}</td><td>${escapeHtml(latest.note || latest.label)} ${reply}</td></tr>`;
    }).join("")}</tbody></table></div>
    ${auditLog(batch)}</div>`).join("");
}

function renderProvider() {
  const changes = drafts();
  const batches = providerBatches();
  const held = changes.filter((change) => change.field === "row").length;
  return topbar("Practice workspace", PROVIDER, "AM") + `<div class="page">
    ${heading("practice", PRACTICE, "Roster changes", "Review updates from your practice roster and track what the plan posts.")}
    <section class="source" aria-labelledby="source-title">
      <div class="source-icon">${icon("file")}</div>
      <div class="source-text"><h2 id="source-title">cedar-grove-roster.csv</h2>
        <p>${state.synced ? "Version 2 loaded · Compared with the last confirmed roster" : "Practice master roster · Sample version 2 available"}</p></div>
      <div class="source-actions">
        ${button("Download sample CSV", "download", { glyph: "download", style: "text" })}
        ${button(state.synced ? "Sample CSV synced" : "Sync sample CSV", "sync", { glyph: state.synced ? "check" : "sync", style: "primary", disabled: state.synced })}
      </div>
    </section>
    <div class="stats" aria-label="Practice roster summary">
      ${stat("diff", changes.length, "Changes awaiting review")}
      ${stat("flag", held, "Held for review", "amber")}
      ${stat("send", batches.length, "Batches submitted", "green")}
    </div>
    <section class="panel" aria-labelledby="detected-title">
      <header class="panel-header"><div class="panel-title"><h2 id="detected-title" tabindex="-1">Detected changes</h2>
        <p>Confirm which changes to send to ${PLAN}.</p></div></header>
      ${renderDraftTable(changes)}
    </section>
    <section class="panel" aria-labelledby="history-title">
      <header class="panel-header"><div class="panel-title"><h2 id="history-title" tabindex="-1">Submission history</h2><p>Track individual changes after you send a batch.</p></div><span class="count">${batches.length} ${batches.length === 1 ? "batch" : "batches"}</span></header>
      ${renderProviderHistory(batches)}
    </section>
  </div>`;
}

function renderQueue(batches) {
  if (!batches.length) return empty("plan", "No batches match these filters", "Change the status or practice filter to see more submissions.");
  return `<div class="table-scroll" tabindex="0" role="region" aria-label="Practice submissions">
    <table class="queue-table"><thead><tr><th scope="col">Batch / practice</th><th scope="col">Submitted</th><th scope="col">Changes</th><th scope="col">Flagged</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Review batch</span></th></tr></thead>
    <tbody>${batches.map((batch) => {
      const flagged = batch.changes.filter(hasOpenException).length;
      const current = activeBatchId === batch.id;
      return `<tr class="${current ? "active" : ""}">
        <td><strong>${batch.practice}</strong><span class="meta"><span class="batch-id">${batch.id}</span> · ${batch.by}</span></td>
        <td><time datetime="${batch.time}">${timeLabel(batch.time)}</time></td>
        <td>${batch.changes.length}</td><td>${flagged || "—"}</td><td>${badge(batchStatus(batch))}</td>
        <td><button class="button ${current ? "text" : "secondary"} small" data-action="open-batch" data-value="${batch.id}" aria-label="Review ${batch.id} from ${batch.practice}">${current ? "Viewing" : "Review"} ${icon("arrow")}</button></td></tr>`;
    }).join("")}</tbody></table></div>`;
}

function renderPlanChange(change) {
  const flag = reviewFlag(change);
  const latest = change.audit.at(-1);
  const current = change.status === "posted" ? change.planValueBeforePosting : planValue(change);
  return `<article class="change-card">
    <div class="change-head"><div><h3>${FIELD_LABELS[change.field]}</h3><span class="meta">${escapeHtml(change.name)} · ${change.providerId}</span></div>${badge(STATUS[change.status])}</div>
    <div class="values">
      <div class="value"><span>${change.status === "posted" ? "Plan value before posting" : "Current plan value"}</span><strong>${escapeHtml(current)}</strong></div>
      <div class="value"><span>Previous practice value</span><strong>${escapeHtml(change.before)}</strong></div>
      <div class="value proposed"><span>Practice-confirmed update</span><strong>${escapeHtml(change.after)}</strong></div>
    </div>
    ${flag ? `<p class="flag">${icon("flag")} ${escapeHtml(flag)}</p>` : ""}
    ${latest.note ? `<p class="decision"><strong>${escapeHtml(latest.actor)}</strong> · ${escapeHtml(latest.note)}</p>` : ""}
    ${change.status === "submitted" ? `<div class="inline-actions">
      ${button("Request clarification", "clarify", { value: change.id, style: "secondary small" })}
      ${button("Escalate", "escalate", { value: change.id, style: "secondary small", glyph: "flag" })}
    </div>` : ""}
  </article>`;
}

function renderBatch(batch) {
  const ready = batch.changes.filter(readyToApprove).length;
  const approved = batch.changes.filter((change) => change.status === "approved").length;
  return `<section class="panel detail" id="batch-detail" aria-labelledby="batch-title">
    <header class="panel-header">
      <div class="panel-title"><h2 id="batch-title" tabindex="-1">${batch.id} · ${batch.practice}</h2><p>Practice confirmation by ${batch.by} · ${timeLabel(batch.time)}</p></div>
      <div class="inline-actions">
        ${ready ? button("Approve ready (" + ready + ")", "approve", { glyph: "check", style: "primary" }) : ""}
        ${approved ? button("Simulate posting (" + approved + ")", "post", { glyph: "send", style: ready ? "secondary" : "primary" }) : ""}
        ${!ready && !approved ? badge(batchStatus(batch)) : ""}
      </div>
    </header>
    <div class="change-list">${batch.changes.map(renderPlanChange).join("")}</div>
    ${auditLog(batch)}
  </section>`;
}

function renderPlan() {
  const changes = state.batches.flatMap((batch) => batch.changes);
  const practices = [...new Set(state.batches.map((batch) => batch.practice))].sort();
  const statuses = [...new Set(state.batches.map((batch) => batchStatus(batch)[0]))].sort();
  const options = (values, current) => values.map((value) => `<option value="${escapeHtml(value)}" ${current === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("");
  const filtered = state.batches.filter((batch) =>
    (queueFilter === "all" || batchStatus(batch)[0] === queueFilter) &&
    (practiceFilter === "all" || batch.practice === practiceFilter)
  );
  const active = filtered.find((batch) => batch.id === activeBatchId);
  return topbar("Plan workspace", ANALYST, "TC") + `<div class="page">
    ${heading("plan", PLAN, "Roster review queue", "Review batches across practices, approve routine changes, and route exceptions.")}
    <div class="stats" aria-label="Plan roster summary">
      ${stat("file", state.batches.filter((batch) => batch.changes.some((change) => change.status !== "posted")).length, "Open batches")}
      ${stat("flag", changes.filter(hasOpenException).length, "Open exceptions", "amber")}
      ${stat("check", changes.filter((change) => change.status === "posted").length, "Changes posted", "green")}
    </div>
    <section class="panel" aria-labelledby="queue-title">
      <header class="panel-header"><div class="panel-title"><h2 id="queue-title">Practice submissions</h2><p>Most recent first · ${filtered.length} of ${state.batches.length} batches</p></div>
        <div class="filters"><label class="sr-only" for="practice-filter">Filter by practice</label><select id="practice-filter"><option value="all">All practices</option>${options(practices, practiceFilter)}</select>
        <label class="sr-only" for="queue-filter">Filter by status</label><select id="queue-filter"><option value="all">All statuses</option>${options(statuses, queueFilter)}</select></div>
      </header>
      ${renderQueue(filtered)}
    </section>
    ${active ? renderBatch(active) : ""}
  </div>`;
}

function render(focusId) {
  document.querySelector("#provider-role").setAttribute("aria-pressed", String(role === "provider"));
  document.querySelector("#plan-role").setAttribute("aria-pressed", String(role === "plan"));
  main.innerHTML = role === "provider" ? renderProvider() : renderPlan();
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
}

function submitBatch() {
  const changes = drafts().filter((change) => change.field !== "row" && selected.has(change.id));
  if (!changes.length) return;
  const time = new Date().toISOString();
  const id = "RB-" + state.nextBatch++;
  state.batches.unshift({
    id, practice: PRACTICE, by: PROVIDER, time,
    changes: changes.map((change) => ({
      ...change, status: "submitted",
      audit: [activity(PROVIDER, "Submitted", "", time)]
    }))
  });
  selected.clear();
  activeBatchId = id;
  saveState();
  render("history-title");
  notice(id + " submitted to the plan. Switch to Plan analyst to review it.");
}

function applyPlanAction(action) {
  const batch = state.batches.find((item) => item.id === activeBatchId);
  if (!batch) return;
  const changes = action === "approve" ? batch.changes.filter(readyToApprove) : batch.changes.filter((change) => change.status === "approved");
  if (!changes.length) return;
  for (const change of changes) {
    if (action === "approve") {
      change.status = "approved";
      change.audit.push(activity(ANALYST, "Approved", "Approved for downstream posting."));
    } else {
      change.planValueBeforePosting = planValue(change);
      state.records[change.providerId][change.field] = change.after;
      change.status = "posted";
      change.audit.push(activity("Plan roster system", "Posted", "Posting confirmed by the simulated plan system."));
    }
  }
  queueFilter = "all";
  saveState();
  render("batch-title");
  notice(changes.length + (changes.length === 1 ? " change " : " changes ") + (action === "approve" ? "approved." : "posted."));
}

function openDialog(action, value) {
  const [batchId, changeId] = action === "reply" ? value.split("/") : [activeBatchId, value];
  const batch = state.batches.find((item) => item.id === batchId);
  const change = batch?.changes.find((item) => item.id === changeId);
  if (action !== "reset" && !change) return;
  const titles = { escalate: "Escalate change", clarify: "Request clarification", reply: "Reply to analyst", reset: "Reset demo?" };
  dialogAction = { action, change };
  document.querySelector("#dialog-title").textContent = titles[action];
  document.querySelector("#dialog-context").textContent = change
    ? change.name + " · " + FIELD_LABELS[change.field]
    : "Clear your demo changes and restore the sample roster and review queue.";
  document.querySelector("#dialog-submit").textContent = action === "reset" ? "Reset demo" : action === "escalate" ? "Escalate change" : "Send " + (action === "reply" ? "reply" : "request");
  const teamField = action === "escalate" ? `<label for="decision-team">Assign to</label><select id="decision-team" name="team">
    <option>Network Operations</option><option>Credentialing</option><option>Data Quality</option></select>` : "";
  const fieldLabel = action === "escalate" ? "Reason" : action === "reply" ? "Your reply" : "Question for the practice";
  document.querySelector("#dialog-fields").innerHTML = action === "reset" ? "" : teamField +
    `<label for="decision-note">${fieldLabel}</label><textarea id="decision-note" name="note" rows="3" maxlength="240" required placeholder="${action === "escalate" ? "Explain what the team should verify" : "Enter a message"}"></textarea>`;
  if (action === "escalate" && change.field === "location") {
    document.querySelector("#decision-note").value = "Verify network participation at " + change.after + ".";
  }
  dialog.showModal();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const { action, change } = dialogAction;
  const fields = new FormData(form);
  const note = String(fields.get("note") || "").trim();
  if (action !== "reset" && !note) {
    document.querySelector("#decision-note").focus();
    return;
  }
  dialog.close();
  if (action === "reset") {
    state = initialState();
    role = "provider";
    queueFilter = "all";
    practiceFilter = "all";
    activeBatchId = null;
    selected.clear();
    auditsOpen.clear();
    window.scrollTo(0, 0);
  } else if (action === "escalate") {
    change.status = "escalated";
    change.audit.push(activity(ANALYST, "Escalated", fields.get("team") + " · " + note));
  } else if (action === "clarify") {
    change.status = "clarification";
    change.audit.push(activity(ANALYST, "Clarification requested", note));
  } else {
    change.status = "submitted";
    change.audit.push(activity(PROVIDER, "Practice replied", note));
  }
  queueFilter = "all";
  saveState();
  render(action === "reset" ? "page-title" : action === "reply" ? "history-title" : "batch-title");
  const messages = { reset: "Demo reset.", clarify: "Clarification request sent to the practice.", escalate: "Change escalated. Other changes can still move forward.", reply: "Reply sent. The change is back in the plan review queue." };
  notice(messages[action]);
});

function downloadSample() {
  const url = URL.createObjectURL(new Blob([UPDATED_CSV + "\n"], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "cedar-grove-roster.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const { action, value } = target.dataset;
  switch (action) {
    case "role":
      if (role === value) return;
      role = value;
      render("page-title");
      window.scrollTo(0, 0);
      break;
    case "sync":
      if (state.synced) return;
      state.synced = true;
      drafts().filter((change) => change.field !== "row").forEach((change) => selected.add(change.id));
      saveState();
      render("detected-title");
      notice("Sample CSV synced. Two changes can be submitted and one is held for review.");
      break;
    case "submit":
      submitBatch();
      break;
    case "download":
      downloadSample();
      break;
    case "open-batch":
      activeBatchId = value;
      render("batch-title");
      document.querySelector("#batch-detail")?.scrollIntoView({ block: "nearest" });
      break;
    case "approve":
    case "post":
      applyPlanAction(action);
      break;
    case "reset":
    case "clarify":
    case "escalate":
    case "reply":
      openDialog(action, value);
      break;
    case "close-dialog":
      dialog.close();
      break;
  }
});

main.addEventListener("change", (event) => {
  const target = event.target;
  if (target.dataset.select) {
    if (target.checked) selected.add(target.dataset.select);
    else selected.delete(target.dataset.select);
    const submit = document.querySelector("#submit-batch");
    submit.disabled = !selected.size;
    submit.innerHTML = icon("send") + "Approve &amp; submit selected (" + selected.size + ")";
    document.querySelector("#selection-summary").textContent = selected.size + " selected for submission";
  } else if (target.id === "queue-filter" || target.id === "practice-filter") {
    if (target.id === "queue-filter") queueFilter = target.value;
    else practiceFilter = target.value;
    render(target.id);
  }
});

main.addEventListener("toggle", (event) => {
  const key = event.target.dataset.audit;
  if (!key || !main.contains(event.target)) return;
  if (event.target.open) auditsOpen.add(key);
  else auditsOpen.delete(key);
}, true);

drafts().filter((change) => change.field !== "row").forEach((change) => selected.add(change.id));
render();
