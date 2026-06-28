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
      // "remake" is on both Kusini Bay and NYC Wasteland.
      expect(data?.totalCount).toBe(2);
    });

    it("Can get Browse(with multiple tags, AND semantics)", async () => {
      const { data, error } = await api.ugc.browse.get({
        query: { tags: "classic,remake" },
      });
      expect(error).toBeNull();
      // Only Kusini Bay carries BOTH "classic" and "remake".
      expect(data?.totalCount).toBe(1);
      expect(data?.assets[0]?.name).toBe("Kusini Bay");
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

describe("Tags", () => {
  describe("GET /tags/search", () => {
    it("Returns most popular tags when searchTerm is empty", async () => {
      const { data, error } = await api.tags.search.get({ query: {} });
      expect(error).toBeNull();
      expect(data?.tags).toBeArray();
      // "remake" is on two assets — the most-used tag in the seed set.
      expect(data?.tags[0]).toEqual({ tag: "remake", count: 2 });
    });

    it("Filters tags by substring", async () => {
      const { data, error } = await api.tags.search.get({
        query: { searchTerm: "rema" },
      });
      expect(error).toBeNull();
      expect(data?.tags).toEqual([{ tag: "remake", count: 2 }]);
    });

    it("Tag search is case-insensitive", async () => {
      const { data, error } = await api.tags.search.get({
        query: { searchTerm: "REMA" },
      });
      expect(error).toBeNull();
      expect(data?.tags.map((t) => t.tag)).toContain("remake");
    });

    it("Respects the count cap", async () => {
      const { data, error } = await api.tags.search.get({
        query: { count: 3 },
      });
      expect(error).toBeNull();
      expect(data?.tags.length).toBeLessThanOrEqual(3);
    });
  });
});
