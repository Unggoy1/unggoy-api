// test/index.test.ts
import { beforeAll, describe, expect, it, afterAll } from "bun:test";
import { app } from "../src/index";
import { treaty } from "@elysiajs/eden";
import { ugcAsset } from "./seeds/ugc";
import { resetDatabase, seedDatabase } from "./seed";

beforeAll(async () => {
  await seedDatabase();
});

afterAll(async () => {
  await resetDatabase();
});
const api = treaty<typeof app>(app);

describe("Ugc", () => {
  describe("GET /asset", () => {
    it("Can get an asset", async () => {
      const { data, error } = await api.ugc
        .asset({
          assetId: "4eb7a3ac-81f7-4faa-acd8-ce6bbba667af",
        })
        .get();
      expect(error).toBeNull();
      expect(data).toStrictEqual(ugcAsset);
    });
  });
  describe("GET /browse", () => {
    it("Can get Browse(no query paramss)", async () => {
      const { data, error } = await api.ugc.browse.get({ query: {} });
      expect(error).toBeNull();
      expect(data).toBeObject();
    });

    it("Can get Browse(with assetKind filter)", async () => {
      const { data, error } = await api.ugc.browse.get({
        query: { assetKind: 2 },
      });
      expect(error).toBeNull();
      expect(data).toBeObject();
    });

    it("Can get Browse(with title search)", async () => {
      const { data, error } = await api.ugc.browse.get({
        query: { searchTerm: "kusi" },
      });
      expect(error).toBeNull();
      expect(data).toBeObject();
    });

    it("Can get Browse(with gamertag search)", async () => {
      const { data, error } = await api.ugc.browse.get({
        query: { gamertag: "CalebderMighty" },
      });
      expect(error).toBeNull();
      expect(data).toBeObject();
    });

    it("Can get Browse(with gamertag search ownerOnly true)", async () => {
      const { data, error } = await api.ugc.browse.get({
        query: { gamertag: "CalebderMighty", ownerOnly: true },
      });
      expect(error).toBeNull();
      expect(data).toBeObject();
    });

    it("Can get Browse(with tag search)", async () => {
      const { data, error } = await api.ugc.browse.get({
        query: { tags: "remake" },
      });
      expect(error).toBeNull();
      expect(data).toBeObject();
    });

    it("Can get Browse(sorted)", async () => {
      const { data, error } = await api.ugc.browse.get({
        query: { sort: "name" },
      });
      expect(error).toBeNull();
      expect(data).toBeObject();
    });
  });
});
