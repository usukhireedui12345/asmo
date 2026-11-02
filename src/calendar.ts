import { Router, type Request, type Response } from "express";
import { requireLogin } from "./middleware.ts";

const router = Router();
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

function page(adminName: string, year: number, month: number): string {
  const firstDay = new Date(year, month - 1, 1);
  const monthLength = new Date(year, month, 0).getDate();
  const startOffset = firstDay.getDay();
  const weekCount = Math.ceil((startOffset + monthLength) / 7);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const previous = new Date(year, month - 2, 1);
  const next = new Date(year, month, 1);
  const monthLabel = firstDay.toLocaleDateString("en", { month: "long", year: "numeric" });

  const cells = Array.from({ length: weekCount * 7 }, (_, index) => {
    const day = index - startOffset + 1;
    if (day < 1 || day > monthLength) return '<td class="outside" aria-hidden="true"></td>';
    const isToday = isCurrentMonth && today.getDate() === day;
    return `<td${isToday ? ' class="today" aria-current="date"' : ""}><span>${day}</span></td>`;
  });
  const rows = Array.from({ length: weekCount }, (_, weekIndex) => {
    return `<tr>${cells.slice(weekIndex * 7, weekIndex * 7 + 7).join("")}</tr>`;
  }).join("");
  const headings = weekdays.map((weekday) => `<th scope="col">${weekday}</th>`).join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>SchoolERP | Calendar</title>
    <style>
      :root { font-family: ui-sans-serif, system-ui, sans-serif; color: #17231d; background: #edf2eb; }
      * { box-sizing: border-box; }
      body { margin: 0; }
      header { display: flex; justify-content: space-between; gap: 20px; padding: 14px max(24px, calc((100% - 1040px) / 2)); background: #245c3b; color: white; }
      header a { color: white; text-decoration: none; }
      main { width: min(1040px, calc(100% - 40px)); margin: 34px auto; }
      .month-nav { display: flex; justify-content: space-between; align-items: center; gap: 18px; margin-bottom: 18px; }
      h1 { margin: 0; font-size: 1.8rem; }
      .month-nav a { padding: 9px 13px; border: 1px solid #b8c8bc; border-radius: 4px; background: white; color: #245c3b; text-decoration: none; }
      section { padding: 14px; background: white; border: 1px solid #d5dfd6; border-radius: 6px; }
      table { width: 100%; table-layout: fixed; border-collapse: collapse; }
      th { padding: 12px 4px; color: #53645a; font-size: .88rem; font-weight: 600; }
      td { height: 92px; padding: 9px; border: 1px solid #e0e8e1; vertical-align: top; }
      td span { display: inline-grid; width: 30px; aspect-ratio: 1; place-items: center; border-radius: 50%; }
      td.today span { background: #245c3b; color: white; font-weight: 700; }
      td.outside { background: #f7f9f7; }
      @media (max-width: 700px) { header { padding: 14px 20px; } main { width: calc(100% - 20px); margin: 20px auto; } section { padding: 6px; } th { font-size: .7rem; } td { height: 58px; padding: 4px; } }
    </style>
  </head>
  <body>
    <header><a href="/dashboard"><strong>SchoolERP</strong></a><span>${escapeHtml(adminName)} · <a href="/attendance">Attendance</a> · <a href="/admin">Administration</a></span></header>
    <main>
      <nav class="month-nav" aria-label="Calendar month navigation">
        <a href="/calendar?year=${previous.getFullYear()}&month=${previous.getMonth() + 1}" aria-label="Previous month">Previous</a>
        <h1>${escapeHtml(monthLabel)}</h1>
        <a href="/calendar?year=${next.getFullYear()}&month=${next.getMonth() + 1}" aria-label="Next month">Next</a>
      </nav>
      <section><table><thead><tr>${headings}</tr></thead><tbody>${rows}</tbody></table></section>
    </main>
  </body>
</html>`;
}

router.get("/calendar", requireLogin, (request: Request, response: Response) => {
  const currentDate = new Date();
  const rawYear = typeof request.query.year === "string" ? Number(request.query.year) : currentDate.getFullYear();
  const rawMonth = typeof request.query.month === "string" ? Number(request.query.month) : currentDate.getMonth() + 1;
  if (!Number.isInteger(rawYear) || rawYear < 1900 || rawYear > 2100 || !Number.isInteger(rawMonth) || rawMonth < 1 || rawMonth > 12) {
    response.status(400).type("text").send("Invalid calendar month");
    return;
  }
  response.type("html").send(page(request.session.adminName ?? "Administrator", rawYear, rawMonth));
});

export default router;