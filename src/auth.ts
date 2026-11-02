import { timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import bcrypt from "bcryptjs";
import { database } from "./db.ts";
import { requireLogin } from "./middleware.ts";
import { dashboardPage, loginPage } from "./views.ts";

interface AdminRow extends RowDataPacket {
  admin_id: number;
  admin_email: string;
  admin_password: string;
  admin_name: string;
}

const router = Router();

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$/.test(value);
}

router.get("/", (request: Request, response: Response) => {
  if (request.session.adminId) {
    response.redirect("/dashboard");
    return;
  }
  response.type("html").send(loginPage());
});

router.post("/auth/login", async (request: Request, response: Response, next) => {
  const email = typeof request.body.email === "string" ? request.body.email.trim() : "";
  const password = typeof request.body.password === "string" ? request.body.password : "";

  if (!email || !password || email.length > 100 || password.length > 255) {
    response.status(400).type("html").send(loginPage("Enter a valid email and password."));
    return;
  }

  try {
    const [admins] = await database.execute<AdminRow[]>(
      "SELECT admin_id, admin_email, admin_password, admin_name FROM admin WHERE admin_email = ? LIMIT 1",
      [email],
    );
    const admin = admins[0];
    if (!admin) {
      response.status(401).type("html").send(loginPage("Invalid email or password."));
      return;
    }

    const passwordMatches = isBcryptHash(admin.admin_password)
      ? await bcrypt.compare(password, admin.admin_password)
      : safeEqual(password, admin.admin_password);

    if (!passwordMatches) {
      response.status(401).type("html").send(loginPage("Invalid email or password."));
      return;
    }

    if (!isBcryptHash(admin.admin_password)) {
      const passwordHash = await bcrypt.hash(password, 12);
      await database.execute<ResultSetHeader>(
        "UPDATE admin SET admin_password = ? WHERE admin_id = ? AND admin_password = ?",
        [passwordHash, admin.admin_id, admin.admin_password],
      );
    }

    request.session.regenerate((error) => {
      if (error) {
        next(error);
        return;
      }
      request.session.adminId = admin.admin_id;
      request.session.adminName = admin.admin_name;
      request.session.save((saveError) => {
        if (saveError) {
          next(saveError);
          return;
        }
        response.redirect("/dashboard");
      });
    });
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard", requireLogin, (request: Request, response: Response) => {
  response.type("html").send(dashboardPage(request.session.adminName ?? "Administrator"));
});

router.post("/auth/logout", (request: Request, response: Response, next) => {
  request.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }
    response.clearCookie("school_erp_session").redirect("/");
  });
});

export default router;