import { Router, type Request, type Response } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { database } from "./db.ts";
import { requireLogin } from "./middleware.ts";

interface FeeHeadRow extends RowDataPacket {
  fees_heading: string;
}

interface FeeCategoryRow extends RowDataPacket {
  category_name: string;
}

interface ClassRow extends RowDataPacket {
  class: number;
}

interface FeePlanRow extends RowDataPacket {
  class: string;
  category: string;
  fees_heading: string;
  value: number;
}

interface FeeHeadGroupRow extends RowDataPacket {
  fees_head_group_name: string;
}

interface AccountRow extends RowDataPacket {
  account_name: string;
}

interface FeeHeadRecord extends RowDataPacket {
  fees_heading: string;
  group_name: string;
  account_name: string;
  frequency: string;
  [month: string]: unknown;
}

const router = Router();
const monthFields = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
] as const;
const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const frequencies = ["annual", "bi_monthly", "half_yearly", "monthly", "one_time", "quaterly", "four_monthly", "custom"];

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function stringValues(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function page(adminName: string, content: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>SchoolERP | Fee plans</title>
    <style>
      :root { font-family: ui-sans-serif, system-ui, sans-serif; color: #17231d; background: #edf2eb; }
      * { box-sizing: border-box; }
      body { margin: 0; }
      header { display: flex; justify-content: space-between; gap: 20px; padding: 14px max(24px, calc((100% - 1120px) / 2)); background: #245c3b; color: white; }
      header a { color: white; text-decoration: none; }
      main { width: min(1120px, calc(100% - 40px)); margin: 34px auto; }
      h1 { margin: 0 0 20px; font-size: 1.8rem; }
      h2 { font-size: 1.1rem; }
      section { margin-bottom: 20px; padding: 20px; background: white; border: 1px solid #d5dfd6; border-radius: 6px; }
      .layout { display: grid; grid-template-columns: minmax(260px, 360px) minmax(0, 1fr); gap: 20px; align-items: start; }
      fieldset { display: flex; flex-wrap: wrap; gap: 10px; border: 1px solid #d5dfd6; border-radius: 4px; }
      .month { display: flex; align-items: center; gap: 5px; }
      .month input { width: auto; }
      label { display: grid; gap: 6px; margin: 12px 0; font-size: .9rem; font-weight: 600; }
      input, select { width: 100%; padding: 10px; border: 1px solid #bbc9be; border-radius: 4px; background: white; font: inherit; }
      input[type="checkbox"] { width: auto; accent-color: #245c3b; }
      .options { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 8px; max-height: 180px; overflow: auto; }
      .options label { display: flex; align-items: center; gap: 7px; margin: 0; font-weight: 400; }
      button { padding: 10px 14px; border: 0; border-radius: 4px; background: #245c3b; color: white; font: inherit; font-weight: 600; cursor: pointer; }
      .table-wrap { overflow-x: auto; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 10px 8px; border-bottom: 1px solid #dce5dd; text-align: left; }
      th { color: #53645a; font-size: .85rem; }
      .notice { color: #245c3b; }
      @media (max-width: 760px) { header { padding: 14px 20px; } .layout { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <header><a href="/dashboard"><strong>SchoolERP</strong></a><span>${escapeHtml(adminName)} · <a href="/admin">Administration</a></span></header>
    <main>${content}</main>
  </body>
</html>`;
}

async function loadFeeHeadData() {
  const [groups] = await database.query<FeeHeadGroupRow[]>("SELECT fees_head_group_name FROM fees_head_group ORDER BY fees_head_group_name");
  const [accounts] = await database.query<AccountRow[]>("SELECT account_name FROM account ORDER BY account_name");
  const [heads] = await database.query<FeeHeadRecord[]>("SELECT fees_heading, group_name, account_name, frequency, january, february, march, april, may, june, july, august, september, october, november, december FROM fees_head ORDER BY fees_heading");
  return { groups, accounts, heads };
}

function renderFeeHeads(adminName: string, data: Awaited<ReturnType<typeof loadFeeHeadData>>, saved: boolean): string {
  const groups = data.groups.map((row) => `<option value="${escapeHtml(row.fees_head_group_name)}">${escapeHtml(row.fees_head_group_name)}</option>`).join("");
  const accounts = data.accounts.map((row) => `<option value="${escapeHtml(row.account_name)}">${escapeHtml(row.account_name)}</option>`).join("");
  const frequencyOptions = frequencies.map((frequency) => `<option value="${frequency}">${frequency.replaceAll("_", " ")}</option>`).join("");
  const monthInputs = monthFields.map((month, index) => `<label class="month"><input type="checkbox" name="months" value="${month}">${monthLabels[index]}</label>`).join("");
  const headRows = data.heads.length
    ? data.heads.map((head) => `<tr><td>${escapeHtml(head.fees_heading)}</td><td>${escapeHtml(head.group_name)}</td><td>${escapeHtml(head.account_name)}</td><td>${escapeHtml(head.frequency.replaceAll("_", " "))}</td>${monthFields.map((month) => `<td>${Number(head[month]) === 1 ? "Yes" : "No"}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${monthFields.length + 4}">No fee heads found.</td></tr>`;
  const content = `<h1>Fee heads</h1>
    <p><a href="/fees/plan">Fee plans</a> · <a href="/admin/masters/fee-groups">Fee head groups</a></p>
    ${saved ? '<p class="notice" role="status">Fee head saved.</p>' : ""}
    <section><h2>Create a fee head</h2><form method="post" action="/fees/heads">
      <label>Fee heading<input name="fees_heading" maxlength="20" required></label>
      <label>Group<select name="group_name" required><option value="">Select group</option>${groups}</select></label>
      <label>Account<select name="account_name" required><option value="">Select account</option>${accounts}</select></label>
      <label>Frequency<select name="frequency" required><option value="">Select frequency</option>${frequencyOptions}</select></label>
      <fieldset><legend>Applicable months</legend><div class="months">${monthInputs}</div></fieldset>
      <p><button type="submit">Save fee head</button></p>
    </form></section>
    <section><h2>Existing fee heads</h2><div class="table-wrap"><table><thead><tr><th>Heading</th><th>Group</th><th>Account</th><th>Frequency</th>${monthLabels.map((month) => `<th>${month}</th>`).join("")}</tr></thead><tbody>${headRows}</tbody></table></div></section>`;
  return page(adminName, content);
}

async function loadFeePlanData() {
  const [heads] = await database.query<FeeHeadRow[]>("SELECT fees_heading FROM fees_head ORDER BY fees_heading");
  const [categories] = await database.query<FeeCategoryRow[]>("SELECT category_name FROM fees_plan_category ORDER BY category_name");
  const [classes] = await database.query<ClassRow[]>("SELECT `class` FROM `class` ORDER BY `class`");
  const [plans] = await database.query<FeePlanRow[]>(
    "SELECT class, category, fees_heading, value FROM fees_plan ORDER BY class, category, fees_heading",
  );
  return { heads, categories, classes, plans };
}

function renderFeePlanPage(
  adminName: string,
  data: Awaited<ReturnType<typeof loadFeePlanData>>,
  saved: boolean,
): string {
  const headOptions = data.heads
    .map((row) => `<option value="${escapeHtml(row.fees_heading)}">${escapeHtml(row.fees_heading)}</option>`)
    .join("");
  const categoryOptions = data.categories
    .map((row) => `<label><input type="checkbox" name="categories" value="${escapeHtml(row.category_name)}">${escapeHtml(row.category_name)}</label>`)
    .join("");
  const classOptions = data.classes
    .map((row) => `<label><input type="checkbox" name="classes" value="${row.class}">${row.class}</label>`)
    .join("");
  const rows = data.plans.length
    ? data.plans
        .map((row) => `<tr><td>${escapeHtml(row.class)}</td><td>${escapeHtml(row.category)}</td><td>${escapeHtml(row.fees_heading)}</td><td>${row.value}</td></tr>`)
        .join("")
    : '<tr><td colspan="4">No fee plans found.</td></tr>';
  const content = `<h1>Fee plans</h1>
    <p><a href="/fees/heads">Fee heads</a> · <a href="/admin/masters/fee-groups">Fee head groups</a> · <a href="/admin/masters/fee-categories">Fee plan categories</a></p>
    ${saved ? '<p class="notice" role="status">Fee plan saved.</p>' : ""}
    <div class="layout">
      <section><h2>Assign a fee amount</h2><form method="post" action="/fees/plan">
        <label>Fee head<select name="fees_heading" required><option value="">Select a fee head</option>${headOptions}</select></label>
        <label>Amount<input name="value" type="number" min="0" max="9999999" step="1" required></label>
        <h2>Categories</h2><div class="options">${categoryOptions || "No fee categories configured."}</div>
        <h2>Classes</h2><div class="options">${classOptions || "No classes configured."}</div>
        <p><button type="submit">Save plan</button></p>
      </form></section>
      <section><h2>Current fee plans</h2><div class="table-wrap"><table><thead><tr><th>Class</th><th>Category</th><th>Fee head</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    </div>`;
  return page(adminName, content);
}

router.get(["/fees", "/fees/plan", "/fees/fees_plan"], requireLogin, async (request: Request, response: Response, next) => {
  try {
    const data = await loadFeePlanData();
    response.type("html").send(renderFeePlanPage(request.session.adminName ?? "Administrator", data, request.query.saved === "1"));
  } catch (error) {
    next(error);
  }
});

router.get("/fees/heads", requireLogin, async (request: Request, response: Response, next) => {
  try {
    const data = await loadFeeHeadData();
    response.type("html").send(renderFeeHeads(request.session.adminName ?? "Administrator", data, request.query.saved === "1"));
  } catch (error) {
    next(error);
  }
});

router.post("/fees/heads", requireLogin, async (request: Request, response: Response, next) => {
  const heading = typeof request.body.fees_heading === "string" ? request.body.fees_heading.trim() : "";
  const groupName = typeof request.body.group_name === "string" ? request.body.group_name.trim() : "";
  const accountName = typeof request.body.account_name === "string" ? request.body.account_name.trim() : "";
  const frequency = typeof request.body.frequency === "string" ? request.body.frequency : "";
  const months = new Set(stringValues(request.body.months));
  if (!heading || heading.length > 20 || !groupName || !accountName || !frequencies.includes(frequency) || [...months].some((month) => !monthFields.includes(month as (typeof monthFields)[number]))) {
    response.status(400).type("text").send("Enter a valid fee head, group, account, frequency, and month selection");
    return;
  }

  try {
    const [existing] = await database.execute<FeeHeadRecord[]>("SELECT fees_heading FROM fees_head WHERE fees_heading = ? LIMIT 1", [heading]);
    const [groups] = await database.execute<FeeHeadGroupRow[]>("SELECT fees_head_group_name FROM fees_head_group WHERE fees_head_group_name = ? LIMIT 1", [groupName]);
    const [accounts] = await database.execute<AccountRow[]>("SELECT account_name FROM account WHERE account_name = ? LIMIT 1", [accountName]);
    if (existing.length || !groups.length || !accounts.length) {
      response.status(400).type("text").send("The fee heading already exists or a selected group/account is unavailable");
      return;
    }

    const monthValues = monthFields.map((month) => months.has(month) ? 1 : 0);
    const columns = ["fees_heading", "group_name", "account_name", "frequency", ...monthFields.map((month) => `\`${month}\``)].join(", ");
    const placeholders = Array.from({ length: 4 + monthFields.length }, () => "?").join(", ");
    await database.execute<ResultSetHeader>(
      `INSERT INTO fees_head (${columns}) VALUES (${placeholders})`,
      [heading, groupName, accountName, frequency, ...monthValues],
    );
    response.redirect("/fees/heads?saved=1");
  } catch (error) {
    next(error);
  }
});

router.post("/fees/plan", requireLogin, async (request: Request, response: Response, next) => {
  const heading = typeof request.body.fees_heading === "string" ? request.body.fees_heading.trim() : "";
  const amountValue = typeof request.body.value === "string" ? request.body.value : "";
  const categories = [...new Set(stringValues(request.body.categories))];
  const classes = [...new Set(stringValues(request.body.classes))];
  const amount = Number(amountValue);

  if (!heading || !/^[0-9]+$/.test(amountValue) || !Number.isSafeInteger(amount) || amount > 9999999 || !categories.length || !classes.length) {
    response.status(400).type("text").send("Choose a fee head, amount, at least one category, and at least one class");
    return;
  }

  let connection: PoolConnection | undefined;
  try {
    const [heads] = await database.execute<FeeHeadRow[]>("SELECT fees_heading FROM fees_head WHERE fees_heading = ? LIMIT 1", [heading]);
    const [validCategories] = await database.query<FeeCategoryRow[]>("SELECT category_name FROM fees_plan_category");
    const [validClasses] = await database.query<ClassRow[]>("SELECT `class` FROM `class`");
    const categorySet = new Set(validCategories.map((row) => row.category_name));
    const classSet = new Set(validClasses.map((row) => String(row.class)));

    if (!heads.length || categories.some((category) => !categorySet.has(category)) || classes.some((className) => !classSet.has(className))) {
      response.status(400).type("text").send("The selected fee head, category, or class is no longer available");
      return;
    }

    connection = await database.getConnection();
    await connection.beginTransaction();
    for (const className of classes) {
      for (const category of categories) {
        const [existing] = await connection.execute<RowDataPacket[]>(
          "SELECT 1 FROM fees_plan WHERE fees_heading = ? AND category = ? AND class = ? LIMIT 1",
          [heading, category, className],
        );
        if (existing.length) {
          await connection.execute<ResultSetHeader>(
            "UPDATE fees_plan SET value = ? WHERE fees_heading = ? AND category = ? AND class = ?",
            [amount, heading, category, className],
          );
        } else {
          await connection.execute<ResultSetHeader>(
            "INSERT INTO fees_plan (fees_heading, value, category, class) VALUES (?, ?, ?, ?)",
            [heading, amount, category, className],
          );
        }
      }
    }
    await connection.commit();
    response.redirect("/fees/plan?saved=1");
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    connection?.release();
  }
});

export default router;