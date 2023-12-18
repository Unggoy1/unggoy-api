import { Elysia } from "elysia";
import { maps } from "./routes/ugc";
import { login } from "./routes/login";
import { user } from "./routes/user";
import { logout } from "./routes/logout";

const app = new Elysia()
  .get("/", () => "Hello Elysia")
  .use(maps)
  .use(login)
  .use(user)
  .use(logout)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
