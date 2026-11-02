import express from "express";
import session from "express-session";
import adminRouter from "./admin.ts";
import admissionsRouter from "./admissions.ts";
import attendanceRouter from "./attendance.ts";
import calendarRouter from "./calendar.ts";
import authRouter from "./auth.ts";
import enquiryRouter from "./enquiry.ts";
import feesRouter from "./fees.ts";

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET is required. Copy .env.example to .env and set a secret.");
}

export const app = express();

app.disable("x-powered-by");
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use(
  session({
    name: "school_erp_session",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 8 * 60 * 60 * 1000,
    },
  }),
);
app.use(authRouter);
app.use(adminRouter);
app.use(attendanceRouter);
app.use(admissionsRouter);
app.use(calendarRouter);
app.use(enquiryRouter);
app.use(feesRouter);

app.use((_request, response) => {
  response.status(404).type("text").send("Not found");
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  response.status(500).type("text").send("Internal server error");
});