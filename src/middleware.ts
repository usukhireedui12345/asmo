import type { RequestHandler } from "express";

export const requireLogin: RequestHandler = (request, response, next) => {
  if (!request.session.adminId) {
    response.redirect("/");
    return;
  }
  next();
};