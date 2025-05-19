import Elysia from "elysia";
import { authApp } from "../middleware";
import { lucia } from "../lucia";
import { TooManyRequests, Unauthorized } from "../lib/errors";
import { rateLimit } from "elysia-rate-limit";
import { cloudflareGenerator } from "../lib/rateLimit";
import { server } from "..";

export const logout = new Elysia()
  .use(
    rateLimit({
      scoping: "scoped",
      errorResponse: new TooManyRequests(),
      generator: cloudflareGenerator,
      injectServer: () => {
        return server!;
      },
    }),
  )
  .use(authApp)
  .get(
    "/logout",
    async ({
      user,
      session,
      cookie,
      set,
      query: { redirectUrl },
      redirect,
    }) => {
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
      set.headers["Cache-Control"] = "private, no-store, max-age=0";
      return redirect(redirectUrl);
    },
  );
