import { Elysia } from "elysia";
import { maps } from "./routes/ugc";
// import { login } from "./routes/login";
// import { user } from "./routes/user";
// import { logout } from "./routes/logout";
import { cors } from "@elysiajs/cors";
import dotenv from "dotenv";

dotenv.config();
const PORT = process.env.PORT || 3000;
const app = new Elysia()
  .use(
    cors({
      origin: "unggoy.xyz", //TODO properly fix this and use ENV or replace this entirely
    }),
  )
  .get("/", () => "Hello Elysia")
  .use(maps)
  // .use(login)
  // .use(user)
  // .use(logout)
  .listen(PORT);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
