import Elysia from "elysia";
import { auth } from "../lucia";

export const logout = new Elysia().get("/logout", async (context) => {
  const authRequest = auth.handleRequest(context);
  const session = await authRequest.validate();
  if (!session) {
    context.set.status = 401;
    return;
  }
  await auth.invalidateSession(session.sessionId);
  authRequest.setSession(null);
  //redirect back to login page
  context.set.redirect = "/login";
  return;
});
