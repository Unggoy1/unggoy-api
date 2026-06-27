import { Elysia, t } from "elysia";
import prisma from "../prisma";
import { TooManyRequests } from "../lib/errors";
import { rateLimit } from "elysia-rate-limit";
import { cloudflareGenerator } from "../lib/rateLimit";
import { server } from "..";
import { assetKind } from "./ugc";

// One search item shape per UGC kind, matching /ugc/browse's `assets`.
async function searchUgc(searchTerm: string, kind: number, count: number) {
  const [data, totalCount] = await prisma.ugc.findManyAndCount({
    where: {
      name: {
        contains: searchTerm,
      },
      assetKind: kind,
    },
    include: {
      tag: {
        select: {
          name: true,
        },
      },
      contributors: true,
    },
    omit: {
      files: true,
      numberOfObjects: true,
      createdAt: true,
      updatedAt: true,
    },
    // Same default ordering as /ugc/browse?searchTerm=...
    orderBy: {
      publishedAt: "desc",
    },
    take: count,
  });

  const items = data.map((asset) => {
    return {
      ...asset,
      tags: asset.tag.map((t) => t.name),
      tag: undefined,
    };
  });

  return { items, totalCount };
}

// Public playlists matching the term, matching /playlist/browse's `assets`.
async function searchPlaylists(searchTerm: string, count: number) {
  const [data, totalCount] = await prisma.playlist.findManyAndCount({
    where: {
      private: false,
      name: {
        contains: searchTerm,
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: count,
  });

  return { items: data, totalCount };
}

// Creators whose gamertag partially matches, with the same owned aggregation
// as GET /creator/:gamertag (a creator is someone with owned assets and/or
// public playlists). Ranked by totalPlays desc.
async function searchCreators(searchTerm: string, count: number) {
  // Candidate identities: asset authors and public-playlist owners. A person's
  // User.username equals their Contributor.gamertag, so a gamertag match
  // surfaces them from whichever record exists.
  const [authorMatches, userMatches] = await Promise.all([
    prisma.contributor.findMany({
      where: {
        gamertag: {
          contains: searchTerm,
        },
        authorUgc: {
          some: {},
        },
      },
      select: {
        xuid: true,
        gamertag: true,
        serviceTag: true,
        emblemPath: true,
      },
    }),
    prisma.user.findMany({
      where: {
        username: {
          contains: searchTerm,
        },
        Playlist: {
          some: {
            private: false,
          },
        },
      },
      select: {
        id: true,
        xuid: true,
        username: true,
        serviceTag: true,
        emblemPath: true,
      },
    }),
  ]);

  // Merge by xuid; the contributor (author) entry wins for identity.
  const creatorsByXuid = new Map<
    string,
    {
      xuid: string;
      gamertag: string;
      serviceTag: string;
      emblemPath: string | null;
    }
  >();
  for (const u of userMatches) {
    creatorsByXuid.set(u.xuid, {
      xuid: u.xuid,
      gamertag: u.username,
      serviceTag: u.serviceTag,
      emblemPath: u.emblemPath,
    });
  }
  for (const a of authorMatches) {
    creatorsByXuid.set(a.xuid, {
      xuid: a.xuid,
      gamertag: a.gamertag,
      serviceTag: a.serviceTag,
      emblemPath: a.emblemPath,
    });
  }

  const candidates = [...creatorsByXuid.values()];
  if (candidates.length === 0) {
    return { items: [], totalCount: 0 };
  }

  const xuids = candidates.map((c) => c.xuid);
  const userIds = userMatches.map((u) => u.id);
  const userIdToXuid = new Map(userMatches.map((u) => [u.id, u.xuid]));

  // Owned counts + total plays per author (soft-deleted assets excluded by the
  // middleware), and public playlist counts per owner. Two grouped queries
  // regardless of how many creators matched.
  const [assetGroups, playlistGroups] = await Promise.all([
    prisma.ugc.groupBy({
      by: ["authorId", "assetKind"],
      where: {
        authorId: {
          in: xuids,
        },
      },
      _count: {
        _all: true,
      },
      _sum: {
        playsAllTime: true,
      },
    }),
    userIds.length > 0
      ? prisma.playlist.groupBy({
          by: ["userId"],
          where: {
            private: false,
            userId: {
              in: userIds,
            },
          },
          _count: {
            _all: true,
          },
        })
      : Promise.resolve([] as { userId: string; _count: { _all: number } }[]),
  ]);

  const statsByXuid = new Map<
    string,
    {
      ownedMaps: number;
      ownedModes: number;
      ownedPrefabs: number;
      totalPlays: number;
    }
  >();
  for (const g of assetGroups) {
    const s = statsByXuid.get(g.authorId) ?? {
      ownedMaps: 0,
      ownedModes: 0,
      ownedPrefabs: 0,
      totalPlays: 0,
    };
    const groupCount = g._count._all;
    if (g.assetKind === assetKind.Map) {
      s.ownedMaps += groupCount;
    } else if (g.assetKind === assetKind.Mode) {
      s.ownedModes += groupCount;
    } else if (g.assetKind === assetKind.Prefab) {
      s.ownedPrefabs += groupCount;
    }
    s.totalPlays += g._sum.playsAllTime ?? 0;
    statsByXuid.set(g.authorId, s);
  }

  const playlistCountByXuid = new Map<string, number>();
  for (const g of playlistGroups) {
    const xuid = userIdToXuid.get(g.userId);
    if (xuid) {
      playlistCountByXuid.set(xuid, g._count._all);
    }
  }

  let items = candidates.map((c) => {
    const s = statsByXuid.get(c.xuid) ?? {
      ownedMaps: 0,
      ownedModes: 0,
      ownedPrefabs: 0,
      totalPlays: 0,
    };
    return {
      gamertag: c.gamertag,
      serviceTag: c.serviceTag,
      emblemPath: c.emblemPath,
      xuid: c.xuid,
      ownedMaps: s.ownedMaps,
      ownedModes: s.ownedModes,
      ownedPrefabs: s.ownedPrefabs,
      playlists: playlistCountByXuid.get(c.xuid) ?? 0,
      totalPlays: s.totalPlays,
    };
  });

  // Keep only real creators (owned assets and/or public playlists), matching
  // the existence rule GET /creator/:gamertag enforces with its 404.
  items = items.filter(
    (i) =>
      i.ownedMaps + i.ownedModes + i.ownedPrefabs > 0 || i.playlists > 0,
  );

  items.sort(
    (a, b) =>
      b.totalPlays - a.totalPlays || a.gamertag.localeCompare(b.gamertag),
  );

  const totalCount = items.length;
  return { items: items.slice(0, count), totalCount };
}

export const search = new Elysia()
  .use(
    rateLimit({
      scoping: "scoped",
      errorResponse: new TooManyRequests(),
      max: 100,
      generator: cloudflareGenerator,
      injectServer: () => {
        return server!;
      },
    }),
  )
  .get(
    "/search",
    async ({ set, query: { searchTerm, count = 8 } }) => {
      set.headers["Cache-Control"] =
        "public, max-age=1800, stale-while-revalidate=60";

      const term = (searchTerm ?? "").trim();

      // Blank/missing query: empty sections, still a 200.
      if (!term) {
        return {
          searchTerm: term,
          creators: { items: [], totalCount: 0 },
          maps: { items: [], totalCount: 0 },
          modes: { items: [], totalCount: 0 },
          prefabs: { items: [], totalCount: 0 },
          playlists: { items: [], totalCount: 0 },
        };
      }

      // One round-trip: every section resolves concurrently.
      const [maps, modes, prefabs, playlists, creators] = await Promise.all([
        searchUgc(term, assetKind.Map, count),
        searchUgc(term, assetKind.Mode, count),
        searchUgc(term, assetKind.Prefab, count),
        searchPlaylists(term, count),
        searchCreators(term, count),
      ]);

      return { searchTerm: term, creators, maps, modes, prefabs, playlists };
    },
    {
      query: t.Partial(
        t.Object({
          searchTerm: t.String(),
          count: t.Number({
            minimum: 1,
            maximum: 30,
            default: 8,
          }),
        }),
      ),
    },
  );
