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

export function loginPage(error?: string): string {
  const errorMessage = error
    ? `<p role="alert" class="error">${escapeHtml(error)}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>SchoolERP | Sign in</title>
    <style>
      :root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; color: #17231d; background: #edf2eb; }
      * { box-sizing: border-box; }
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; background: linear-gradient(135deg, #edf2eb, #dce8df); }
      main { width: min(100%, 410px); padding: 36px; background: #fff; border: 1px solid #d5dfd6; border-radius: 8px; box-shadow: 0 18px 55px #20332918; }
      h1 { margin: 0 0 8px; font-size: 1.65rem; }
      p { color: #53645a; }
      label { display: block; margin: 20px 0 7px; color: #34443a; font-size: .9rem; font-weight: 600; }
      input { width: 100%; padding: 12px; border: 1px solid #bbc9be; border-radius: 5px; font: inherit; }
      input:focus { outline: 3px solid #a6c5aa; border-color: #3c7650; }
      button { width: 100%; margin-top: 24px; padding: 12px; border: 0; border-radius: 5px; background: #245c3b; color: white; font: inherit; font-weight: 700; cursor: pointer; }
      button:hover { background: #19492e; }
      .error { padding: 11px; border-left: 3px solid #b23c31; background: #fff0ed; color: #8d2923; }
    </style>
  </head>
  <body>
    <main>
      <h1>SchoolERP</h1>
      <p>Sign in to your school account.</p>
      ${errorMessage}
      <form method="post" action="/auth/login">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="username" required>
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required>
        <button type="submit">Sign in</button>
      </form>
    </main>
  </body>
</html>`;
}

export function dashboardPage(adminName: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>SchoolERP | Dashboard</title>
  </head>
  <body>
    <main>
      <h1>Welcome, ${escapeHtml(adminName)}</h1>
      <p>Manage your school records.</p>
      <p><a href="/admissions">Admission register</a> | <a href="/enquiry">Enquiries</a> | <a href="/fees/plan">Fees</a> | <a href="/attendance">Attendance</a> | <a href="/calendar">Calendar</a> | <a href="/admin">Administration and master data</a></p>
      <form method="post" action="/auth/logout"><button type="submit">Sign out</button></form>
    </main>
  </body>
</html>`;
}