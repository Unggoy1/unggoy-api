import Elysia from "elysia";
import { auth } from "../lucia";

export const user = new Elysia().get("/user", async (context) => {
  const authRequest = auth.handleRequest(context);
  const session = await authRequest.validate();
  if (!session) {
    context.set.status = 401;
    return;
  }
  return session.user;
});
