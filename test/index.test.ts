// test/index.test.ts
import { beforeAll, describe, expect, it, afterAll } from "bun:test";
import { app } from "../src/index";
import { treaty } from "@elysiajs/eden";
import { ugcAsset } from "./seeds/ugc";
import prisma from "../src/prisma";
import { assets, contributors, playlists, tags, users } from "./seeds/seedData";

beforeAll(async () => {
  await prisma.user.createMany({
    data: users,
  });

  await prisma.tag.createMany({
    data: tags,
  });

  await prisma.contributor.createMany({
    data: contributors,
  });

  await prisma.ugc.createMany({
    data: assets.map(({ tags, contributors, ...rest }) => rest),
  });

  for (const asset of assets) {
    await prisma.ugc.update({
      where: { assetId: asset.assetId },
      data: {
        contributors: {
          connect: asset.contributors.map((contributor) => {
            return { xuid: contributor.xuid };
          }), // replace 'season-id' with the actual season ID
        },
        tag: {
          connect: asset.tags.map((tag: string) => {
            return { name: tag };
          }),
        },
      },
    });
  }
  await prisma.playlist.createMany({
    data: playlists,
  });
});

afterAll(async () => {
  const deleteAssets = prisma.ugc.deleteMany();
  const deleteTags = prisma.tag.deleteMany({});
  const deleteContributors = prisma.contributor.deleteMany();
  const deletePlaylists = prisma.playlist.deleteMany();
  const deleteUsers = prisma.user.deleteMany();

  await prisma.$transaction([
    deleteAssets,
    deleteTags,
    deleteContributors,
    deleteUsers,
    deletePlaylists,
  ]);

  await prisma.$disconnect();
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
