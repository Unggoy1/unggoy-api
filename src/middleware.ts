import { verifyRequestOrigin } from "oslo/request";
import { lucia } from "./lucia";
import type { Session, User } from "lucia";
import { Elysia } from "elysia";

export const authApp = new Elysia().derive(
  { as: "global" },
  async (
    context,
  ): Promise<{
    user: User | null;
    session: Session | null;
  }> => {
    // CSRF check
    if (context.request.method !== "GET") {
      const originHeader = context.request.headers.get("Origin");
      const hostHeader = context.request.headers.get("Host");
      console.log("originHeader: ", originHeader);
      console.log("hostHeader: ", hostHeader);
      if (
        !originHeader ||
        !hostHeader ||
        !verifyRequestOrigin(originHeader, [hostHeader, "localhost:5173"])
      ) {
        console.log("we dun goofed with csrf");
        return {
          user: null,
          session: null,
        };
      }
    }

    // use headers instead of Cookie API to prevent type coercion
    const cookieHeader = context.request.headers.get("Cookie") ?? "";
    console.log(cookieHeader);
    const sessionId = lucia.readSessionCookie(cookieHeader);
    console.log(sessionId);
    if (!sessionId) {
      console.log("we dun goofed generating a session");
      return {
        user: null,
        session: null,
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
      // await lucia.invalidateSession(sessionId);
      const sessionCookie = lucia.createBlankSessionCookie();
      context.cookie[sessionCookie.name].set({
        value: sessionCookie.value,
        ...sessionCookie.attributes,
      });
    }
    console.log("we got a session boy so why it no work");
    return {
      user,
      session,
    };
  },
);
