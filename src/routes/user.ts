import Elysia from "elysia";
import { authApp } from "../middleware";
export const user = new Elysia().use(authApp).get("/user", async (context) => {
  if (!context.user) {
    return new Response(null, {
      status: 401,
    });
  }
  return context.user;
});
