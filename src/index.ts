import { Elysia, ValidationError } from "elysia";
import { maps } from "./routes/ugc";
import { login } from "./routes/login";
import { user } from "./routes/user";
import { logout } from "./routes/logout";
import { cors } from "@elysiajs/cors";
import { playlists, playlists2, playlists3 } from "./routes/playlist";
import { favorites, favorites2 } from "./routes/favorites";
import { cron, Patterns } from "@elysiajs/cron";
import { lucia } from "./lucia";
import {
  Duplicate,
  Forbidden,
  NotFound,
  Unauthorized,
  Unknown,
  Validation,
} from "./lib/errors";
import type { Server } from "bun";

declare module "bun" {
  interface Env {
    DATABASE_URL: string;
    AZURE_CLIENT_ID: string;
    AZURE_CLIENT_SECRET: string;
    AZURE_TENANT: string;
    AZURE_REDIRECT_URI: string;
    AZURE_SCOPE: string;
    PORT: string;
    CORS_URL: string;
    DOMAIN: string;
    AWS_ACCESS_KEY_ID: string;
    AWS_SECRET_ACCESS_KEY: string;
    AWS_ENDPOINT_URL: string;
    AWS_REGION: string;
    S3_BUCKET_NAME: string;
    IMAGE_DOMAIN: string;
  }
}

export let server: Server | null;
const PORT = process.env.PORT || 3000;
export const app = new Elysia()
  .use(
    cors({
      origin: process.env.CORS_URL || "localhost:5173",
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "PUT", "POST", "DELETE"],
      credentials: true,
    }),
  )
  .use(
    cron({
      name: "CleanSessions",
      pattern: Patterns.EVERY_DAY_AT_6AM,
      run: async () => {
        const date = new Date();
        console.log("Starting Cron Job: ", date.toString());
        await lucia.deleteExpiredSessions();
      },
    }),
  )
  .error({ Unauthorized, Forbidden, NotFound, Duplicate, Unknown, Validation })
  .onError(({ code, error }) => {
    const customErrors = [
      "Unauthorized",
      "Forbidden",
      "NotFound",
      "Duplicate",
      "Unknown",
      "Validation",
      "VALIDATION",
    ];
    if (code === "VALIDATION") {
      const vError: ValidationError = error;
      if (error instanceof ValidationError) {
        return new Validation(error.all[0].summary);
      }
      const err = JSON.parse(error.message);
      return new Validation(err.summary);
    }
    if (customErrors.includes(code)) return error;
    return new Error(error.toString());
  })
  .get("/", () => "Hello Elysia")
  .use(maps)
  .use(login)
  .use(user)
  .use(logout)
  .use(playlists)
  .use(playlists2)
  .use(playlists3)
  .use(favorites)
  .use(favorites2)
  .listen(PORT);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
server = app.server;
