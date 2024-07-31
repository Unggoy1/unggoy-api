import Elysia from "elysia";
import { authApp } from "../middleware";
import { lucia } from "../lucia";

export const logout = new Elysia()
  .use(authApp)
  .get(
    "/logout",
    async ({ user, session, cookie, set, query: { redirectUrl } }) => {
      if (!user || !session) {
        return new Response(null, {
          status: 401,
        });
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
