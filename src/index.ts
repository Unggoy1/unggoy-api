import { Elysia } from "elysia";
import { maps } from "./routes/ugc";

const app = new Elysia()
  .get("/", () => "Hello Elysia")
  .use(maps)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
