import { Lucia, TimeSpan } from "lucia";
import { PrismaAdapter } from "@lucia-auth/adapter-prisma";
import { MicrosoftEntraId } from "arctic";
import prisma from "./prisma";

const adapter = new PrismaAdapter(prisma.session, prisma.user);
export const lucia = new Lucia(adapter, {
  getUserAttributes: (attributes) => {
    return {
      username: attributes.username,
      xuid: attributes.xuid,
    };
  },
  sessionExpiresIn: new TimeSpan(30, "d"), // no more active/idle
  sessionCookie: {
    name: "auth_session",
    expires: true, // session cookies have very long lifespan (2 years)
    attributes: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      domain: process.env.DOMAIN || "localhost",
    },
  },
});

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseSessionAttributes: DatabaseSessionAttributes;
    DatabaseUserAttributes: DatabaseUserAttributes;
  }
  interface DatabaseSessionAttributes { }
  interface DatabaseUserAttributes {
    username: string;
    oid: string;
    xuid: string;
  }
}
const clientId = process.env.AZURE_CLIENT_ID ?? "";
const clientSecret = process.env.AZURE_CLIENT_SECRET ?? "";
const redirectURI = process.env.AZURE_REDIRECT_URI ?? "";
export const entraId = new MicrosoftEntraId(
  "consumers",
  clientId,
  clientSecret,
  redirectURI,
);
