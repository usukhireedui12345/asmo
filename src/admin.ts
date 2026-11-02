import { Router, type Request, type Response } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { database } from "./db.ts";
import { requireLogin } from "./middleware.ts";

interface MasterField {
  name: string;
  label: string;
  type: "text" | "date" | "number";
  maxLength?: number;
}

interface MasterDefinition {
  label: string;
  table: string;
  idColumn: string;
  fields: MasterField[];
}

interface MasterRow extends RowDataPacket {
  id: number;
}

const masterDefinitions: Record<string, MasterDefinition> = {
  classes: {
    label: "Classes",
    table: "class",
    idColumn: "class_id",
    fields: [
      { name: "class", label: "Class", type: "number" },
      { name: "prefix", label: "Prefix", type: "text", maxLength: 5 },
      { name: "start_from", label: "Start from", type: "date" },
      { name: "incharge", label: "Incharge", type: "text", maxLength: 25 },
    ],
  },
  sections: {
    label: "Sections",
    table: "section",
    idColumn: "section_id",
    fields: [{ name: "section_name", label: "Section", type: "text", maxLength: 5 }],
  },
  castes: {
    label: "Castes",
    table: "caste",
    idColumn: "caste_id",
    fields: [{ name: "caste_name", label: "Caste", type: "text", maxLength: 20 }],
  },
  categories: {
    label: "Categories",
    table: "category",
    idColumn: "category_id",
    fields: [{ name: "category_name", label: "Category", type: "text", maxLength: 10 }],
  },
  houses: {
    label: "Houses",
    table: "house",
    idColumn: "house_id",
    fields: [{ name: "house_name", label: "House", type: "text", maxLength: 30 }],
  },
  families: {
    label: "Families",
    table: "family",
    idColumn: "family_id",
    fields: [{ name: "family_name", label: "Family", type: "text", maxLength: 20 }],
  },
  "fee-groups": {
    label: "Fee head groups",
    table: "fees_head_group",
    idColumn: "fees_head_group_id",
    fields: [{ name: "fees_head_group_name", label: "Group name", type: "text", maxLength: 25 }],
  },
  "fee-categories": {
    label: "Fee plan categories",
    table: "fees_plan_category",
    idColumn: "category_id",
    fields: [{ name: "category_name", label: "Category name", type: "text", maxLength: 50 }],
  },
};

const router = Router();

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

function getMaster(entity: string): MasterDefinition | undefined {
  return masterDefinitions[entity];
}

function getEntity(request: Request): string {
  const entity = request.params.entity;
  return Array.isArray(entity) ? entity[0] ?? "" : entity;
}

function page(title: string, content: string, adminName: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>SchoolERP | ${escapeHtml(title)}</title>
    <style>
      :root { font-family: ui-sans-serif, system-ui, sans-serif; color: #17231d; background: #edf2eb; }
      * { box-sizing: border-box; }
      body { margin: 0; }
      header { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 14px max(24px, calc((100% - 1120px) / 2)); background: #245c3b; color: white; }
      header a { color: white; text-decoration: none; }
      main { width: min(1120px, calc(100% - 40px)); margin: 36px auto; }
      h1 { font-size: 1.8rem; margin: 0 0 24px; }
      h2 { font-size: 1.15rem; margin: 0 0 16px; }
      a { color: #245c3b; }
      .links { display: flex; flex-wrap: wrap; gap: 10px; }
      .links a { padding: 10px 14px; background: white; border: 1px solid #c9d6cb; border-radius: 5px; }
      .layout { display: grid; grid-template-columns: minmax(240px, 330px) minmax(0, 1fr); gap: 28px; align-items: start; }
      section { padding: 22px; background: white; border: 1px solid #d5dfd6; border-radius: 6px; }
      label { display: block; margin: 14px 0 6px; font-size: .9rem; font-weight: 600; }
      input { width: 100%; padding: 10px; border: 1px solid #bbc9be; border-radius: 4px; font: inherit; }
      button { padding: 9px 13px; border: 0; border-radius: 4px; background: #245c3b; color: white; font: inherit; font-weight: 600; cursor: pointer; }
      button.delete { background: #a3332d; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 10px 8px; border-bottom: 1px solid #dce5dd; text-align: left; vertical-align: middle; }
      th { color: #53645a; font-size: .85rem; }
      .notice { margin: 0 0 16px; color: #245c3b; }
      .row-form { margin: 0; }
      @media (max-width: 700px) { header { padding: 14px 20px; } .layout { grid-template-columns: 1fr; } section { overflow-x: auto; } }
    </style>
  </head>
  <body>
    <header><a href="/dashboard"><strong>SchoolERP</strong></a><span>${escapeHtml(adminName)} · <a href="/auth/logout" onclick="event.preventDefault(); document.getElementById('logout').submit()">Sign out</a><form id="logout" method="post" action="/auth/logout" hidden></form></span></header>
    <main>${content}</main>
  </body>
</html>`;
}

function renderAdminPage(adminName: string): string {
  const links = Object.entries(masterDefinitions)
    .map(([entity, definition]) => `<a href="/admin/masters/${entity}">${escapeHtml(definition.label)}</a>`)
    .join("");

  return page(
    "Administration",
    `<h1>Administration</h1><p>School master data</p><nav class="links">${links}</nav>`,
    adminName,
  );
}

function renderMasterPage(
  adminName: string,
  entity: string,
  definition: MasterDefinition,
  records: MasterRow[],
  notice: boolean,
): string {
  const inputs = definition.fields
    .map(
      (field) => `<label for="${field.name}">${escapeHtml(field.label)}</label>
        <input id="${field.name}" name="${field.name}" type="${field.type}"${field.maxLength ? ` maxlength="${field.maxLength}"` : ""} required>`,
    )
    .join("");
  const headings = definition.fields.map((field) => `<th>${escapeHtml(field.label)}</th>`).join("");
  const rows = records.length
    ? records
        .map((record) => {
          const cells = definition.fields
            .map((field) => `<td>${escapeHtml(String(record[field.name] ?? ""))}</td>`)
            .join("");
          return `<tr>${cells}<td><form class="row-form" method="post" action="/admin/masters/${entity}/delete" onsubmit="return confirm('Delete this record?')"><input type="hidden" name="id" value="${record.id}"><button class="delete" type="submit">Delete</button></form></td></tr>`;
        })
        .join("")
    : `<tr><td colspan="${definition.fields.length + 1}">No records found.</td></tr>`;
  const content = `<p><a href="/admin">Administration</a> / ${escapeHtml(definition.label)}</p>
    <h1>${escapeHtml(definition.label)}</h1>
    ${notice ? '<p class="notice" role="status">Changes saved.</p>' : ""}
    <div class="layout">
      <section><h2>Add ${escapeHtml(definition.label.toLowerCase().replace(/s$/, ""))}</h2><form method="post" action="/admin/masters/${entity}">${inputs}<p><button type="submit">Save</button></p></form></section>
      <section><h2>Records</h2><table><thead><tr>${headings}<th>Actions</th></tr></thead><tbody>${rows}</tbody></table></section>
    </div>`;

  return page(definition.label, content, adminName);
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

router.get("/admin", requireLogin, (_request: Request, response: Response) => {
  response.type("html").send(renderAdminPage(response.req.session.adminName ?? "Administrator"));
});

router.get("/admin/masters/:entity", requireLogin, async (request, response, next) => {
  const entity = getEntity(request);
  const definition = getMaster(entity);
  if (!definition) {
    response.status(404).type("text").send("Unknown master list");
    return;
  }

  try {
    const columns = definition.fields.map((field) => `\`${field.name}\``).join(", ");
    const [records] = await database.query<MasterRow[]>(
      `SELECT \`${definition.idColumn}\` AS id, ${columns} FROM \`${definition.table}\` ORDER BY ${columns.split(", ")[0]}`,
    );
    response.type("html").send(
      renderMasterPage(
        request.session.adminName ?? "Administrator",
        entity,
        definition,
        records,
        request.query.saved === "1",
      ),
    );
  } catch (error) {
    next(error);
  }
});

router.post("/admin/masters/:entity", requireLogin, async (request, response, next) => {
  const entity = getEntity(request);
  const definition = getMaster(entity);
  if (!definition) {
    response.status(404).type("text").send("Unknown master list");
    return;
  }

  const values: string[] = [];
  for (const field of definition.fields) {
    const value = typeof request.body[field.name] === "string" ? request.body[field.name].trim() : "";
    if (!value || (field.maxLength && value.length > field.maxLength)) {
      response.status(400).type("text").send(`Invalid ${field.label.toLowerCase()}`);
      return;
    }
    if (field.type === "number" && (!/^\d+$/.test(value) || Number(value) < 0 || Number(value) > 99)) {
      response.status(400).type("text").send("Class must be a whole number from 0 to 99");
      return;
    }
    if (field.type === "date" && !validDate(value)) {
      response.status(400).type("text").send(`Invalid ${field.label.toLowerCase()}`);
      return;
    }
    values.push(value);
  }

  try {
    const columns = definition.fields.map((field) => `\`${field.name}\``).join(", ");
    const placeholders = definition.fields.map(() => "?").join(", ");
    await database.execute<ResultSetHeader>(
      `INSERT INTO \`${definition.table}\` (${columns}) VALUES (${placeholders})`,
      values,
    );
    response.redirect(`/admin/masters/${entity}?saved=1`);
  } catch (error) {
    next(error);
  }
});

router.post("/admin/masters/:entity/delete", requireLogin, async (request, response, next) => {
  const entity = getEntity(request);
  const definition = getMaster(entity);
  const id = Number(request.body.id);
  if (!definition) {
    response.status(404).type("text").send("Unknown master list");
    return;
  }
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).type("text").send("Invalid record id");
    return;
  }

  try {
    await database.execute<ResultSetHeader>(
      `DELETE FROM \`${definition.table}\` WHERE \`${definition.idColumn}\` = ? LIMIT 1`,
      [id],
    );
    response.redirect(`/admin/masters/${entity}?saved=1`);
  } catch (error) {
    next(error);
  }
});

export default router;