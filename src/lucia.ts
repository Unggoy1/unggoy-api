import { lucia } from "lucia";
import { elysia } from "lucia/middleware";
import { prisma } from "@lucia-auth/adapter-prisma";
import { PrismaClient } from "@prisma/client";

const client = new PrismaClient();

export const auth = lucia({
  env: "DEV", // "PROD" if deployed to HTTPS
  middleware: elysia(),
  adapter: prisma(client),
});

export type Auth = typeof auth;
