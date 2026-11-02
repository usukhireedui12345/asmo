import { Router, type Request, type Response } from "express";
import type { RowDataPacket } from "mysql2";
import { database } from "./db.ts";
import { requireLogin } from "./middleware.ts";

interface EnquiryRow extends RowDataPacket {
  enquiry_id: number;
  enquiry_no: string | null;
  class: string;
  first_name: string;
  last_name: string;
  dob: string | null;
  gender: string;
  city: string | null;
  contact_no: string | null;
  date: string;
}

interface EnquirySummaryRow extends RowDataPacket {
  date: string;
  class: string;
  total: number;
}

const router = Router();
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const genders = ["male", "female", "other"];

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

function isValidDate(value: string): boolean {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function page(adminName: string, title: string, content: string): string {
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
      h1 { margin: 0 0 20px; font-size: 1.8rem; }
      section { margin-bottom: 20px; padding: 20px; background: white; border: 1px solid #d5dfd6; border-radius: 6px; }
      .links, .form-grid { display: flex; flex-wrap: wrap; gap: 14px; }
      .form-grid label { display: grid; flex: 1 1 250px; gap: 6px; font-size: .9rem; font-weight: 600; }
      input, select { width: 100%; padding: 10px; border: 1px solid #bbc9be; border-radius: 4px; background: white; font: inherit; }
      button, .button { display: inline-block; padding: 10px 14px; border: 0; border-radius: 4px; background: #245c3b; color: white; font: inherit; font-weight: 600; text-decoration: none; cursor: pointer; }
      .table-wrap { overflow-x: auto; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 10px 8px; border-bottom: 1px solid #dce5dd; text-align: left; vertical-align: middle; }
      th { color: #53645a; font-size: .85rem; }
      .notice { color: #245c3b; }
      .error { color: #8d2923; }
      @media (max-width: 700px) { header { padding: 14px 20px; } section { padding: 14px; } }
    </style>
  </head>
  <body>
    <header><a href="/dashboard"><strong>SchoolERP</strong></a><span>${escapeHtml(adminName)} · <a href="/admissions">Admissions</a> · <a href="/attendance">Attendance</a></span></header>
    <main>${content}</main>
  </body>
</html>`;
}

router.get("/enquiry", requireLogin, async (request: Request, response: Response, next) => {
  try {
    const [enquiries] = await database.query<EnquiryRow[]>(
      "SELECT enquiry_id, enquiry_no, class, first_name, last_name, dob, gender, city, contact_no, date FROM enquiry ORDER BY date DESC, enquiry_id DESC LIMIT 500",
    );
    const rows = enquiries.length
      ? enquiries
          .map(
            (row) => `<tr><td>${escapeHtml(row.enquiry_no ?? "")}</td><td>${escapeHtml(`${row.first_name} ${row.last_name}`)}</td><td>${escapeHtml(row.class)}</td><td>${escapeHtml(row.gender)}</td><td>${escapeHtml(row.dob ?? "")}</td><td>${escapeHtml(row.city ?? "")}</td><td>${escapeHtml(row.contact_no ?? "")}</td><td>${escapeHtml(row.date)}</td></tr>`,
          )
          .join("")
      : '<tr><td colspan="8">No enquiries recorded.</td></tr>';
    const content = `<h1>Enquiries</h1>
      ${request.query.created === "1" ? '<p class="notice" role="status">Enquiry saved.</p>' : ""}
      <nav class="links"><a class="button" href="/enquiry/new">New enquiry</a><a class="button" href="/enquiry/summary">Daily summary</a></nav>
      <section><div class="table-wrap"><table><thead><tr><th>Enquiry no.</th><th>Name</th><th>Class</th><th>Gender</th><th>Date of birth</th><th>City</th><th>Contact</th><th>Date received</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
    response.type("html").send(page(request.session.adminName ?? "Administrator", "Enquiries", content));
  } catch (error) {
    next(error);
  }
});

router.get("/enquiry/new", requireLogin, (request: Request, response: Response) => {
  const content = `<p><a href="/enquiry">Enquiries</a></p><h1>New enquiry</h1>
    <section><form method="post" action="/enquiry/submit">
      <div class="form-grid">
        <label>Enquiry number<input name="enquiry_no" maxlength="30"></label>
        <label>Seeking admission in class<input name="class" maxlength="20" required></label>
        <label>First name<input name="first_name" maxlength="50" required></label>
        <label>Last name<input name="last_name" maxlength="50" required></label>
        <label>Date of birth<input name="dob" type="date"></label>
        <label>Gender<select name="gender" required><option value="">Select gender</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label>
        <label>Address line 1<input name="address1" maxlength="255"></label>
        <label>Address line 2<input name="address2" maxlength="255"></label>
        <label>City<input name="city" maxlength="100"></label>
        <label>Contact number<input name="contact_no" type="tel" maxlength="30"></label>
        <label>Last attended school<input name="last_school" maxlength="150"></label>
        <label>Last exam<input name="last_exam" maxlength="100"></label>
        <label>Year<input name="year" maxlength="20"></label>
      </div>
      <p><button type="submit">Save enquiry</button></p>
    </form></section>`;
  response.type("html").send(page(request.session.adminName ?? "Administrator", "New enquiry", content));
});

router.post("/enquiry/submit", requireLogin, async (request: Request, response: Response, next) => {
  const fields = ["enquiry_no", "class", "first_name", "last_name", "dob", "gender", "address1", "address2", "city", "contact_no", "last_school", "last_exam", "year"] as const;
  const input = Object.fromEntries(fields.map((field) => [field, typeof request.body[field] === "string" ? request.body[field].trim() : ""]));
  const limits: Record<(typeof fields)[number], number> = {
    enquiry_no: 30,
    class: 20,
    first_name: 50,
    last_name: 50,
    dob: 10,
    gender: 10,
    address1: 255,
    address2: 255,
    city: 100,
    contact_no: 30,
    last_school: 150,
    last_exam: 100,
    year: 20,
  };

  for (const field of fields) {
    if (input[field].length > limits[field]) {
      response.status(400).type("text").send(`${field} is too long`);
      return;
    }
  }
  if (!input.class || !input.first_name || !input.last_name || !genders.includes(input.gender)) {
    response.status(400).type("text").send("Class, student name, and a valid gender are required");
    return;
  }
  if (input.dob && !isValidDate(input.dob)) {
    response.status(400).type("text").send("Invalid date of birth");
    return;
  }
  if (input.contact_no && !/^[\d+() .-]{7,30}$/.test(input.contact_no)) {
    response.status(400).type("text").send("Invalid contact number");
    return;
  }

  try {
    await database.execute(
      "INSERT INTO enquiry (enquiry_no, class, first_name, last_name, dob, gender, address1, address2, city, contact_no, last_school, last_exam, year, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE)",
      [input.enquiry_no || null, input.class, input.first_name, input.last_name, input.dob || null, input.gender, input.address1 || null, input.address2 || null, input.city || null, input.contact_no || null, input.last_school || null, input.last_exam || null, input.year || null],
    );
    response.redirect("/enquiry?created=1");
  } catch (error) {
    next(error);
  }
});

router.get("/enquiry/summary", requireLogin, async (request: Request, response: Response, next) => {
  const date = typeof request.query.date === "string" ? request.query.date : new Date().toISOString().slice(0, 10);
  if (!isValidDate(date)) {
    response.status(400).type("text").send("Invalid date");
    return;
  }
  try {
    const [rows] = await database.execute<EnquirySummaryRow[]>(
      "SELECT date, class, COUNT(*) AS total FROM enquiry WHERE date = ? GROUP BY date, class ORDER BY class",
      [date],
    );
    const body = rows.length
      ? rows.map((row) => `<tr><td>${escapeHtml(row.class)}</td><td>${row.total}</td></tr>`).join("")
      : '<tr><td colspan="2">No enquiries recorded for this date.</td></tr>';
    const content = `<p><a href="/enquiry">Enquiries</a></p><h1>Daily enquiry summary</h1>
      <section><form method="get" action="/enquiry/summary"><label>Date <input name="date" type="date" value="${escapeHtml(date)}" required></label> <button type="submit">View</button></form>
      <div class="table-wrap"><table><thead><tr><th>Class</th><th>Enquiries</th></tr></thead><tbody>${body}</tbody></table></div></section>`;
    response.type("html").send(page(request.session.adminName ?? "Administrator", "Enquiry summary", content));
  } catch (error) {
    next(error);
  }
});

export default router;