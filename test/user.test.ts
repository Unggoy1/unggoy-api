// test/index.test.ts
import { beforeAll, describe, expect, it, afterAll } from "bun:test";
import { app } from "../src/index";
import { treaty } from "@elysiajs/eden";
import { getUserSession, resetDatabase, seedDatabase } from "./seed";
import { Cookie, Session } from "lucia";

let session: Session;
let sessionCookie: string;
beforeAll(async () => {
  await seedDatabase();
  const userSession = await getUserSession();
  session = userSession.session;
  sessionCookie = userSession.sessionCookie.serialize();
});

afterAll(async () => {
  await resetDatabase();
});
const api = treaty<typeof app>(app);

describe("User", async () => {
  describe("GET /user", () => {
    it("Can get a users profile", async () => {
      const { data, error } = await api.user.get({
        headers: { Cookie: sessionCookie },
      });
      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data?.username).toEqual("Master Chief");
    });

    it("Cannot get a users profile(no cookies)", async () => {
      const { data, error } = await api.user.get();

      expect(error).not.toBeNull();
      expect(error?.status).toEqual(401);
      expect(data).toBeNull();
    });
  });
});
