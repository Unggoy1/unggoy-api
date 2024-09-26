import { Elysia } from "elysia";
import { maps } from "./routes/ugc";
import { login } from "./routes/login";
import { user } from "./routes/user";
import { logout } from "./routes/logout";
import { cors } from "@elysiajs/cors";
import { playlists } from "./routes/playlist";
import { favorites } from "./routes/favorites";
import { rateLimit } from "elysia-rate-limit";
import {
  Duplicate,
  Forbidden,
  NotFound,
  Unauthorized,
  Unknown,
  Validation,
} from "./lib/errors";

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

const PORT = process.env.PORT || 3000;
export const app = new Elysia()
  .use(
    cors({
      origin: process.env.CORS_URL || "localhost:5173", //TODO properly fix this and use ENV or replace this entirely
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "PUT", "POST", "DELETE"],
      credentials: true,
    }),
  )
  .error({ Unauthorized, Forbidden, NotFound, Duplicate, Unknown, Validation })
  .onError(({ code, error }) => {
    console.log(code);
    console.log(error);
    const customErrors = [
      "Unauthorized",
      "Forbidden",
      "NotFound",
      "Duplicate",
      "Unknown",
      "Validation",
      "VALIDATION",
    ];
    if (customErrors.includes(code)) return error;
    return new Error(error.toString());
  })
  .get("/", () => "Hello Elysia")
  .use(maps)
  .use(login)
  .use(user)
  .use(logout)
  .use(playlists)
  .use(favorites)
  .listen(PORT);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
