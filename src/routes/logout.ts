import Elysia from "elysia";
import { authApp } from "../middleware";
import { lucia } from "../lucia";
import { Unauthorized } from "../lib/errors";

export const logout = new Elysia()
  .use(authApp)
  .get(
    "/logout",
    async ({ user, session, cookie, set, query: { redirectUrl } }) => {
      if (!user || !session) {
        throw new Unauthorized();
      }
      await lucia.invalidateSession(session.id);
      const sessionCookie = lucia.createBlankSessionCookie();
      cookie[sessionCookie.name].set({
        value: sessionCookie.value,
        ...sessionCookie.attributes,
      });

      //redirect back to login page
      set.redirect = redirectUrl;
      return;
    },
  );
