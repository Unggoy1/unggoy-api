import { Elysia } from "elysia";
import { maps } from "./routes/ugc";
import { login } from "./routes/login";
import { user } from "./routes/user";
import { logout } from "./routes/logout";
import { cors } from "@elysiajs/cors";
import { playlists } from "./routes/playlist";
import { favorites } from "./routes/favorites";
import { rateLimit } from "elysia-rate-limit";

const PORT = process.env.PORT || 3000;
const app = new Elysia()
  .use(
    cors({
      origin: process.env.CORS_URL || "localhost:5173", //TODO properly fix this and use ENV or replace this entirely
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "PUT", "POST", "DELETE"],
      credentials: true,
    }),
  )
  // .use(rateLimit())
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
