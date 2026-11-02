import { Router, type Request, type Response } from "express";
import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { database } from "./db.ts";
import { requireLogin } from "./middleware.ts";

interface ClassRow extends RowDataPacket {
  class: number;
}

interface SectionRow extends RowDataPacket {
  section_name: string;
}

interface StudentRow extends RowDataPacket {
  student_id: number;
  student_first_name: string;
  student_middle_name: string;
  student_last_name: string;
  student_class: string;
  student_section: string;
  student_roll_no: number;
  admission_no: number;
}

interface ExistingAttendanceRow extends RowDataPacket {
  student_id: number;
  status: string;
}

interface DailySummaryRow extends RowDataPacket {
  class: string;
  section: string;
  strength: number;
  absent: number;
  present: number;
  on_leave: number;
}

const router = Router();
const statuses = ["P", "A", "L"] as const;
type AttendanceStatus = (typeof statuses)[number];

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

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function page(title: string, adminName: string, content: string): string {
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
      header { display: flex; justify-content: space-between; gap: 20px; padding: 14px max(24px, calc((100% - 1120px) / 2)); background: #245c3b; color: white; }
      header a { color: white; text-decoration: none; }
      main { width: min(1120px, calc(100% - 40px)); margin: 34px auto; }
      h1 { margin: 0 0 22px; font-size: 1.8rem; }
      h2 { font-size: 1.15rem; }
      .toolbar, .filters { display: flex; flex-wrap: wrap; align-items: end; gap: 14px; margin-bottom: 20px; }
      .filters label { display: grid; gap: 6px; font-size: .9rem; font-weight: 600; }
      input, select { min-width: 130px; padding: 10px; border: 1px solid #bbc9be; border-radius: 4px; background: white; font: inherit; }
      button, .button { display: inline-block; padding: 10px 14px; border: 0; border-radius: 4px; background: #245c3b; color: white; font: inherit; font-weight: 600; text-decoration: none; cursor: pointer; }
      section { padding: 20px; background: white; border: 1px solid #d5dfd6; border-radius: 6px; }
      .table-wrap { overflow-x: auto; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 10px 8px; border-bottom: 1px solid #dce5dd; text-align: left; vertical-align: middle; }
      th { color: #53645a; font-size: .85rem; }
      td.status { white-space: nowrap; }
      td.status label { margin-right: 10px; }
      td.status input { min-width: auto; accent-color: #245c3b; }
      .notice { margin: 0 0 16px; color: #245c3b; }
      .empty { color: #53645a; }
      @media (max-width: 700px) { header { padding: 14px 20px; } section { padding: 14px; } }
    </style>
  </head>
  <body>
    <header><a href="/dashboard"><strong>SchoolERP</strong></a><span>${escapeHtml(adminName)} · <a href="/admin">Administration</a></span></header>
    <main>${content}</main>
  </body>
</html>`;
}

function renderClassOptions(classes: ClassRow[], selected: string): string {
  return classes
    .map((row) => {
      const value = String(row.class);
      return `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(value)}</option>`;
    })
    .join("");
}

function renderSectionOptions(sections: SectionRow[], selected: string): string {
  return sections
    .map(
      (row) => `<option value="${escapeHtml(row.section_name)}"${row.section_name === selected ? " selected" : ""}>${escapeHtml(row.section_name)}</option>`,
    )
    .join("");
}

function renderEntryPage(
  adminName: string,
  classes: ClassRow[],
  sections: SectionRow[],
  selectedDate: string,
  selectedClass: string,
  selectedSection: string,
  students: StudentRow[],
  existingStatuses: Map<number, string>,
  saved: boolean,
): string {
  const filters = `<form class="filters" method="get" action="/attendance/entry">
    <label>Date<input type="date" name="date" value="${escapeHtml(selectedDate)}" required></label>
    <label>Class<select name="class" required><option value="">Select class</option>${renderClassOptions(classes, selectedClass)}</select></label>
    <label>Section<select name="section" required><option value="">Select section</option>${renderSectionOptions(sections, selectedSection)}</select></label>
    <button type="submit">Show students</button>
  </form>`;

  const rows = students
    .map((student) => {
      const fullName = [student.student_first_name, student.student_middle_name, student.student_last_name]
        .filter(Boolean)
        .join(" ");
      const checkedStatus = existingStatuses.get(student.student_id) ?? "P";
      const choices = statuses
        .map((status) => {
          const label = status === "P" ? "Present" : status === "A" ? "Absent" : "Leave";
          return `<label><input type="radio" name="status_${student.student_id}" value="${status}"${checkedStatus === status ? " checked" : ""} required> ${label}</label>`;
        })
        .join("");
      return `<tr><td>${escapeHtml(String(student.student_roll_no))}</td><td>${escapeHtml(fullName)}</td><td>${escapeHtml(String(student.admission_no))}</td><td class="status">${choices}</td></tr>`;
    })
    .join("");

  const studentTable = students.length
    ? `<form method="post" action="/attendance/entry/save">
        <input type="hidden" name="date" value="${escapeHtml(selectedDate)}">
        <input type="hidden" name="class" value="${escapeHtml(selectedClass)}">
        <input type="hidden" name="section" value="${escapeHtml(selectedSection)}">
        <div class="table-wrap"><table><thead><tr><th>Roll no.</th><th>Student</th><th>Admission no.</th><th>Attendance</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p><button type="submit">Save attendance</button></p>
      </form>`
    : selectedClass && selectedSection
      ? '<p class="empty">No students found for this class and section.</p>'
      : '<p class="empty">Choose a date, class, and section to load the student list.</p>';

  const content = `<nav class="toolbar"><a class="button" href="/attendance/summary">Daily summary</a></nav>
    <h1>Take attendance</h1>
    ${saved ? '<p class="notice" role="status">Attendance saved.</p>' : ""}
    <section>${filters}${studentTable}</section>`;
  return page("Attendance", adminName, content);
}

function renderSummaryPage(adminName: string, date: string, rows: DailySummaryRow[]): string {
  const body = rows.length
    ? rows
        .map(
          (row) => `<tr><td>${escapeHtml(row.class)}</td><td>${escapeHtml(row.section)}</td><td>${row.strength}</td><td>${row.present}</td><td>${row.absent}</td><td>${row.on_leave}</td></tr>`,
        )
        .join("")
    : '<tr><td colspan="6" class="empty">No attendance recorded for this date.</td></tr>';
  const content = `<nav class="toolbar"><a class="button" href="/attendance/entry">Take attendance</a></nav>
    <h1>Daily attendance summary</h1>
    <section>
      <form class="filters" method="get" action="/attendance/summary">
        <label>Date<input type="date" name="date" value="${escapeHtml(date)}" required></label>
        <button type="submit">View summary</button>
      </form>
      <div class="table-wrap"><table><thead><tr><th>Class</th><th>Section</th><th>Strength</th><th>Present</th><th>Absent</th><th>Leave</th></tr></thead><tbody>${body}</tbody></table></div>
    </section>`;
  return page("Attendance summary", adminName, content);
}

router.get("/attendance", requireLogin, (_request, response) => {
  response.redirect("/attendance/summary");
});

router.get("/attendance/attend_view", requireLogin, (_request, response) => {
  response.redirect("/attendance/summary");
});

router.get("/attendance/attend_new", requireLogin, (_request, response) => {
  response.redirect("/attendance/entry");
});

router.get("/attendance/entry", requireLogin, async (request: Request, response: Response, next) => {
  const queryDate = typeof request.query.date === "string" ? request.query.date : today();
  if (!validDate(queryDate)) {
    response.status(400).type("text").send("Invalid date");
    return;
  }
  const selectedClass = typeof request.query.class === "string" ? request.query.class : "";
  const selectedSection = typeof request.query.section === "string" ? request.query.section : "";

  try {
    const [classes] = await database.query<ClassRow[]>("SELECT `class` FROM `class` ORDER BY `class`");
    const [sections] = await database.query<SectionRow[]>("SELECT `section_name` FROM `section` ORDER BY `section_name`");
    let students: StudentRow[] = [];
    const existingStatuses = new Map<number, string>();

    if (selectedClass && selectedSection) {
      const [studentRows] = await database.execute<StudentRow[]>(
        "SELECT student_id, student_first_name, student_middle_name, student_last_name, student_class, student_section, student_roll_no, admission_no FROM student WHERE student_class = ? AND student_section = ? ORDER BY student_roll_no, student_first_name",
        [selectedClass, selectedSection],
      );
      students = studentRows;
      const [attendanceRows] = await database.execute<ExistingAttendanceRow[]>(
        "SELECT student_id, status FROM attendance WHERE date = ? AND class = ? AND section = ? ORDER BY student_id",
        [queryDate, selectedClass, selectedSection],
      );
      for (const row of attendanceRows) existingStatuses.set(row.student_id, row.status);
    }

    response.type("html").send(
      renderEntryPage(
        request.session.adminName ?? "Administrator",
        classes,
        sections,
        queryDate,
        selectedClass,
        selectedSection,
        students,
        existingStatuses,
        request.query.saved === "1",
      ),
    );
  } catch (error) {
    next(error);
  }
});

router.post("/attendance/entry/save", requireLogin, async (request: Request, response: Response, next) => {
  const date = typeof request.body.date === "string" ? request.body.date : "";
  const className = typeof request.body.class === "string" ? request.body.class : "";
  const sectionName = typeof request.body.section === "string" ? request.body.section : "";
  if (!validDate(date) || !className || className.length > 5 || !sectionName || sectionName.length > 3) {
    response.status(400).type("text").send("Invalid attendance date, class, or section");
    return;
  }

  let connection: PoolConnection | undefined;
  try {
    const [students] = await database.execute<StudentRow[]>(
      "SELECT student_id FROM student WHERE student_class = ? AND student_section = ?",
      [className, sectionName],
    );
    if (!students.length) {
      response.status(400).type("text").send("No students found for this class and section");
      return;
    }

    const entries: Array<{ studentId: number; status: AttendanceStatus }> = [];
    for (const student of students) {
      const value = request.body[`status_${student.student_id}`];
      if (typeof value !== "string" || !statuses.includes(value as AttendanceStatus)) {
        response.status(400).type("text").send("Choose one attendance status for every student");
        return;
      }
      entries.push({ studentId: student.student_id, status: value as AttendanceStatus });
    }

    connection = await database.getConnection();
    await connection.beginTransaction();
    await connection.execute(
      "DELETE FROM attendance WHERE date = ? AND class = ? AND section = ?",
      [date, className, sectionName],
    );
    for (const entry of entries) {
      await connection.execute(
        "INSERT INTO attendance (`date`, `class`, `section`, student_id, status) VALUES (?, ?, ?, ?, ?)",
        [date, className, sectionName, entry.studentId, entry.status],
      );
    }
    await connection.commit();
    response.redirect(`/attendance/entry?date=${encodeURIComponent(date)}&class=${encodeURIComponent(className)}&section=${encodeURIComponent(sectionName)}&saved=1`);
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    connection?.release();
  }
});

router.get("/attendance/summary", requireLogin, async (request: Request, response: Response, next) => {
  const date = typeof request.query.date === "string" ? request.query.date : today();
  if (!validDate(date)) {
    response.status(400).type("text").send("Invalid date");
    return;
  }

  try {
    const [rows] = await database.execute<DailySummaryRow[]>(
      "SELECT class, section, COUNT(*) AS strength, SUM(status = 'P') AS present, SUM(status = 'A') AS absent, SUM(status = 'L') AS on_leave FROM attendance WHERE date = ? GROUP BY class, section ORDER BY class, section",
      [date],
    );
    response.type("html").send(renderSummaryPage(request.session.adminName ?? "Administrator", date, rows));
  } catch (error) {
    next(error);
  }
});

export default router;