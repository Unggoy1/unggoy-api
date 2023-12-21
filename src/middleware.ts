import { verifyRequestOrigin } from "oslo/request";
import { lucia } from "./lucia";
import type { User } from "lucia";
import { Elysia } from "elysia";

export const authApp = new Elysia().derive(
  async (
    context,
  ): Promise<{
    user: User | null;
  }> => {
    // CSRF check
    if (context.request.method !== "GET") {
      const originHeader = context.request.headers.get("Origin");
      const hostHeader = context.request.headers.get("Host");
      if (
        !originHeader ||
        !hostHeader ||
        !verifyRequestOrigin(originHeader, [hostHeader])
      ) {
        console.log("was it me");
        return {
          user: null,
        };
      }
    }

    // use headers instead of Cookie API to prevent type coercion
    const cookieHeader = context.request.headers.get("Cookie") ?? "";
    console.log(cookieHeader);
    const sessionId = lucia.readSessionCookie(cookieHeader);
    if (!sessionId) {
      console.log("or was it me");
      return {
        user: null,
      };
    }

    const { session, user } = await lucia.validateSession(sessionId);
    if (session && session.fresh) {
      const sessionCookie = lucia.createSessionCookie(session.id);
      context.cookie[sessionCookie.name].set({
        value: sessionCookie.value,
        ...sessionCookie.attributes,
      });
    }
    if (!session) {
      const sessionCookie = lucia.createBlankSessionCookie();
      context.cookie[sessionCookie.name].set({
        value: sessionCookie.value,
        ...sessionCookie.attributes,
      });
    }
    return {
      user,
    };
  },
);

authApp.get("/user", async (context) => {
  if (!context.user) {
    return new Response(null, {
      status: 401,
    });
  }
  return context.user;
});
