import { lucia } from "lucia";
import { elysia } from "lucia/middleware";
import { prisma } from "@lucia-auth/adapter-prisma";
import { PrismaClient } from "@prisma/client";
import { azureAD, github } from "@lucia-auth/oauth/providers";
import dotenv from "dotenv";

dotenv.config();

const client = new PrismaClient();

export const auth = lucia({
  env: "DEV", // "PROD" if deployed to HTTPS process.env.NODE_ENV === "development" ? "DEV" : "PROD",
  middleware: elysia(),
  adapter: prisma(client),

  sessionCookie: {
    expires: false,
  },

  getUserAttributes: (data) => {
    return {
      githubUsername: data.username,
    };
  },
});

export const azureAuth = azureAD(auth, {
  clientId: process.env.AZURE_CLIENT_ID ?? "",
  clientSecret: process.env.Azure_CLIENT_SECRET ?? "",
  tenant: process.env.AZURE_TENANT ?? "",
  redirectUri: process.env.AZURE_REDIRECT_URI ?? "",
  // scope: ["XboxLive.signin"],
});

export type Auth = typeof auth;
