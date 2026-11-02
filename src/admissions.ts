import { Router, type Request, type Response } from "express";
import type { RowDataPacket } from "mysql2";
import { database } from "./db.ts";
import { requireLogin } from "./middleware.ts";

interface AdmissionRow extends RowDataPacket {
  admission_no: number;
  student_first_name: string;
  fathers_first_name: string;
  mothers_first_name: string;
  student_class: string;
  student_section: string;
  student_roll_no: number;
  student_dob: string;
  f_mobile: number;
  route: string | null;
  scholarship_no: number;
  fees_balance: number;
}

const searchableFields = {
  admission_no: "Admission number",
  student_first_name: "Student name",
  fathers_first_name: "Father name",
  mothers_first_name: "Mother name",
  student_roll_no: "Roll number",
  city: "City",
  f_mobile: "Contact number",
  student_section: "Section",
  gender: "Gender",
  student_dob: "Date of birth",
  route: "Route",
  category: "Category",
  scholarship_no: "Scholarship number",
  aadhar_uid: "Aadhar UID",
  family: "Family",
  house: "House",
  caste: "Caste",
  student_class: "Class",
} as const;

type SearchField = keyof typeof searchableFields;

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

function isSearchField(value: string): value is SearchField {
  return Object.hasOwn(searchableFields, value);
}

function renderFieldOptions(selected: string): string {
  return Object.entries(searchableFields)
    .map(
      ([field, label]) => `<option value="${field}"${field === selected ? " selected" : ""}>${label}</option>`,
    )
    .join("");
}

function page(adminName: string, content: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>SchoolERP | Admission register</title>
    <style>
      :root { font-family: ui-sans-serif, system-ui, sans-serif; color: #17231d; background: #edf2eb; }
      * { box-sizing: border-box; }
      body { margin: 0; }
      header { display: flex; justify-content: space-between; gap: 20px; padding: 14px max(24px, calc((100% - 1180px) / 2)); background: #245c3b; color: white; }
      header a { color: white; text-decoration: none; }
      main { width: min(1180px, calc(100% - 40px)); margin: 34px auto; }
      h1 { margin: 0 0 20px; font-size: 1.8rem; }
      section { margin-bottom: 20px; padding: 18px; background: white; border: 1px solid #d5dfd6; border-radius: 6px; }
      form { display: flex; flex-wrap: wrap; align-items: end; gap: 12px; }
      label { display: grid; gap: 6px; font-size: .9rem; font-weight: 600; }
      input, select { min-width: 150px; padding: 10px; border: 1px solid #bbc9be; border-radius: 4px; background: white; font: inherit; }
      button { padding: 10px 14px; border: 0; border-radius: 4px; background: #245c3b; color: white; font: inherit; font-weight: 600; cursor: pointer; }
      .table-wrap { overflow-x: auto; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 10px 8px; border-bottom: 1px solid #dce5dd; text-align: left; vertical-align: middle; white-space: nowrap; }
      th { color: #53645a; font-size: .85rem; }
      .muted { color: #53645a; }
      @media (max-width: 700px) { header { padding: 14px 20px; } }
    </style>
  </head>
  <body>
    <header><a href="/dashboard"><strong>SchoolERP</strong></a><span>${escapeHtml(adminName)} · <a href="/attendance">Attendance</a> · <a href="/admin">Administration</a></span></header>
    <main>${content}</main>
  </body>
</html>`;
}

router.get("/admissions", requireLogin, async (request: Request, response: Response, next) => {
  const fieldValue = typeof request.query.field === "string" ? request.query.field : "";
  const searchValue = typeof request.query.value === "string" ? request.query.value.trim() : "";
  const sortValue = typeof request.query.sort === "string" ? request.query.sort : "student_first_name";
  const directionValue = typeof request.query.direction === "string" ? request.query.direction.toUpperCase() : "ASC";

  if ((fieldValue && !isSearchField(fieldValue)) || !isSearchField(sortValue)) {
    response.status(400).type("text").send("Invalid search or sort field");
    return;
  }
  if (directionValue !== "ASC" && directionValue !== "DESC") {
    response.status(400).type("text").send("Invalid sort direction");
    return;
  }

  try {
    const conditions: string[] = [];
    const parameters: string[] = [];
    if (fieldValue && searchValue) {
      conditions.push(`\`${fieldValue}\` = ?`);
      parameters.push(searchValue);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [students] = await database.execute<AdmissionRow[]>(
      `SELECT admission_no, student_first_name, fathers_first_name, mothers_first_name, student_class, student_section, student_roll_no, student_dob, f_mobile, route, scholarship_no, fees_balance FROM student ${where} ORDER BY \`${sortValue}\` ${directionValue} LIMIT 500`,
      parameters,
    );

    const rows = students.length
      ? students
          .map(
            (student, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(student.student_first_name)}</td><td>${escapeHtml(student.fathers_first_name)}</td><td>${escapeHtml(student.mothers_first_name)}</td><td>${escapeHtml(student.student_class)}</td><td>${escapeHtml(student.student_section)}</td><td>${student.student_roll_no}</td><td>${escapeHtml(String(student.student_dob))}</td><td>${escapeHtml(String(student.f_mobile))}</td><td>${escapeHtml(student.route ?? "")}</td><td>${student.scholarship_no}</td><td>${student.fees_balance}</td><td>${student.admission_no}</td></tr>`,
          )
          .join("")
      : '<tr><td colspan="13" class="muted">No student records found.</td></tr>';

    const content = `<h1>Admission register</h1>
      <section><form method="get" action="/admissions">
        <label>Search by<select name="field"><option value="">Choose a field</option>${renderFieldOptions(fieldValue)}</select></label>
        <label>Value<input name="value" value="${escapeHtml(searchValue)}" autocomplete="off"></label>
        <label>Sort by<select name="sort">${renderFieldOptions(sortValue)}</select></label>
        <label>Order<select name="direction"><option value="ASC"${directionValue === "ASC" ? " selected" : ""}>Ascending</option><option value="DESC"${directionValue === "DESC" ? " selected" : ""}>Descending</option></select></label>
        <button type="submit">Apply</button>
      </form></section>
      <section><p class="muted">Showing ${students.length} student${students.length === 1 ? "" : "s"}${students.length === 500 ? " (limit reached)" : ""}</p>
        <div class="table-wrap"><table><thead><tr><th>No.</th><th>Student</th><th>Father</th><th>Mother</th><th>Class</th><th>Section</th><th>Roll</th><th>Date of birth</th><th>Contact</th><th>Route</th><th>Scholarship</th><th>Fee balance</th><th>Admission no.</th></tr></thead><tbody>${rows}</tbody></table></div>
      </section>`;
    response.type("html").send(page(request.session.adminName ?? "Administrator", content));
  } catch (error) {
    next(error);
  }
});

export default router;