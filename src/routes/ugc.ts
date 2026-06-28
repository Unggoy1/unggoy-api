import { Elysia, t } from "elysia";
import { authApp } from "../middleware";
import { load } from "cheerio";
import { getSpartanToken } from "../authTools";
import prisma from "../prisma";
import { NotFound, TooManyRequests } from "../lib/errors";
import { rateLimit } from "elysia-rate-limit";
import { cloudflareGenerator } from "../lib/rateLimit";
import { server } from "..";

export const maps = new Elysia()
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
  .group("/ugc", (app) => {
    return app
      .get("/asset/:assetId", async ({ params: { assetId }, set }) => {
        const asset = await prisma.ugc.findUnique({
          where: { assetId },
          include: {
            tag: {
              select: {
                name: true,
              },
            },
            contributors: true,
          },
        });
        if (!asset) {
          throw new NotFound();
        }

        const filteredAsset: any = {
          ...asset,
          tags: asset.tag.map((t) => t.name),
        };

        filteredAsset.files.fileRelativePaths =
          filteredAsset.files.fileRelativePaths.filter(
            (file: string) => file.endsWith(".jpg") || file.endsWith(".png"),
          );
        delete filteredAsset.tag;

        set.headers["Cache-Control"] =
          "public, max-age=1800, stale-while-revalidate=60";
        return filteredAsset;
      })
      .get(
        "/browse",
        async ({
          set,
          query: {
            assetKind,
            sort = "publishedAt",
            order = "desc",
            count = 20,
            offset = 0,
            tags,
            searchTerm,
            gamertag,
            ownerOnly = false,
            contributorOnly = false,
            recommendedOnly = false,
            hide343Assets = false,
          },
        }) => {
          //TODO: REFACTOR THIS Endpoint. I feel like there are too many query params
          const whereOptions: any = {};

          if (searchTerm) {
            whereOptions.name = {
              contains: searchTerm,
            };
          }
          if (assetKind) {
            whereOptions.assetKind = assetKind;
          }
          if (tags) {
            // Comma-separated tags are ANDed: an asset must carry every listed
            // tag. Each tag needs its own `some` relation filter — a single
            // `some` with `in: [...]` would match assets having ANY of them.
            // A single tag still works (a one-element list).
            const tagList = tags
              .split(",")
              .map((tag) => tag.trim())
              .filter((tag) => tag.length > 0);
            if (tagList.length > 0) {
              whereOptions.AND = tagList.map((name) => ({
                tag: { some: { name } },
              }));
            }
          }
          if (hide343Assets) {
            whereOptions.contributors = {
              none: {
                xuid: "343",
              },
            };
          }
          if (gamertag) {
            if (ownerOnly) {
              whereOptions.author = {
                is: {
                  gamertag: gamertag,
                },
              };
            } else if (contributorOnly) {
              // Contributed-but-not-owned: in the contributor list yet not the
              // author. The complement of ownerOnly.
              whereOptions.contributors = {
                ...whereOptions.contributors,
                some: {
                  gamertag: gamertag,
                },
              };
              whereOptions.author = {
                isNot: {
                  gamertag: gamertag,
                },
              };
            } else {
              whereOptions.contributors = {
                ...whereOptions.contributors,
                some: {
                  gamertag: gamertag,
                },
              };
            }
          }
          if (recommendedOnly === true) {
            whereOptions.recommended = true;
          }

          const [data, totalCount] = await prisma.ugc.findManyAndCount({
            where: whereOptions,

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
            orderBy: {
              [sort]: order,
            },
            take: count,
            skip: offset,
          });

          const assets = data.map((asset) => {
            return {
              ...asset,
              tags: asset.tag.map((t) => t.name),
              tag: undefined,
            };
          });

          set.headers["Cache-Control"] =
            "public, max-age=1800, stale-while-revalidate=60";
          return { totalCount: totalCount, pageSize: count, assets: assets };

          // const results = {
          //   results: jsonContent.props?.pageProps?.results,
          //   totalPages: jsonContent.props?.pageProps?.totalPages,
          //   totalResults: jsonContent.props?.pageProps?.totalResults,
          //   pageSize: jsonContent.props?.pageProps?.pageSize,
          // };
        },
        {
          query: t.Partial(
            t.Object({
              assetKind: t.Number(),
              sort: t.Union(
                [
                  t.Literal("publishedAt"),
                  t.Literal("name"),
                  t.Literal("averageRating"),
                  t.Literal("bookmarks"),
                  t.Literal("playsRecent"),
                  t.Literal("playsAllTime"),
                ],
                {
                  default: "publishedAt",
                },
              ),
              order: t.Union([t.Literal("desc"), t.Literal("asc")], {
                default: "desc",
              }),
              count: t.Number({
                minimum: 1,
                maximum: 30,
                default: 20,
              }),
              offset: t.Number({
                default: 0,
              }),
              tags: t.String(),
              searchTerm: t.String(),
              gamertag: t.String(),
              ownerOnly: t.BooleanString({
                default: false,
              }),
              contributorOnly: t.BooleanString({
                default: false,
              }),
              recommendedOnly: t.BooleanString({
                default: false,
              }),
              hide343Assets: t.BooleanString({
                default: false,
              }),
            }),
          ),
        },
      );
  })
  .get(
    "/creator/:gamertag",
    async ({ params: { gamertag }, set }) => {
      // Owned assets only: the creator is the asset's author, not merely a
      // contributor. The soft-delete middleware excludes deleted assets, and
      // MySQL's default collation makes the gamertag match case-insensitive
      // (same behaviour as /ugc/browse?ownerOnly=true).
      const ownedAssets = await prisma.ugc.findMany({
        where: {
          author: {
            is: {
              gamertag: gamertag,
            },
          },
        },
        select: {
          assetKind: true,
          playsAllTime: true,
          favorites: true,
          averageRating: true,
          numberOfRatings: true,
          publishedAt: true,
          thumbnailUrl: true,
        },
      });

      // Only public playlists are visible on a public creator profile, matching
      // /playlist/browse which hides private playlists.
      const playlistCount = await prisma.playlist.count({
        where: {
          private: false,
          user: {
            username: gamertag,
          },
        },
      });

      if (ownedAssets.length === 0 && playlistCount === 0) {
        throw new NotFound();
      }

      // Identity: prefer the User record; fall back to the contributor entry
      // from one of their owned assets (creators synced from Waypoint may never
      // have logged in).
      const userRecord = await prisma.user.findFirst({
        where: {
          username: gamertag,
        },
        select: {
          username: true,
          serviceTag: true,
          emblemPath: true,
          xuid: true,
        },
      });

      let identity = userRecord
        ? {
            gamertag: userRecord.username,
            serviceTag: userRecord.serviceTag,
            emblemPath: userRecord.emblemPath,
            xuid: userRecord.xuid,
          }
        : null;

      if (!identity) {
        const contributor = await prisma.contributor.findFirst({
          where: {
            gamertag: gamertag,
          },
          select: {
            gamertag: true,
            serviceTag: true,
            emblemPath: true,
            xuid: true,
          },
        });
        if (contributor) {
          identity = contributor;
        }
      }

      if (!identity) {
        throw new NotFound();
      }

      let ownedMaps = 0;
      let ownedModes = 0;
      let ownedPrefabs = 0;
      let totalPlays = 0;
      let totalBookmarks = 0;
      let weightedRatingSum = 0;
      let ratingCountSum = 0;
      let ratedAssetCount = 0;
      let firstPublishedAt: Date | null = null;
      let lastPublishedAt: Date | null = null;
      let featuredThumbnailUrl: string | null = null;
      let featuredPlays = -1;

      for (const asset of ownedAssets) {
        if (asset.assetKind === assetKind.Map) {
          ownedMaps++;
          // Featured backdrop is the most-played owned map.
          if (asset.playsAllTime > featuredPlays) {
            featuredPlays = asset.playsAllTime;
            featuredThumbnailUrl = asset.thumbnailUrl;
          }
        } else if (asset.assetKind === assetKind.Mode) {
          ownedModes++;
        } else if (asset.assetKind === assetKind.Prefab) {
          ownedPrefabs++;
        }

        totalPlays += asset.playsAllTime;
        totalBookmarks += asset.favorites;

        if (asset.numberOfRatings > 0) {
          weightedRatingSum += Number(asset.averageRating) * asset.numberOfRatings;
          ratingCountSum += asset.numberOfRatings;
          ratedAssetCount++;
        }

        if (!firstPublishedAt || asset.publishedAt < firstPublishedAt) {
          firstPublishedAt = asset.publishedAt;
        }
        if (!lastPublishedAt || asset.publishedAt > lastPublishedAt) {
          lastPublishedAt = asset.publishedAt;
        }
      }

      const averageRating =
        ratingCountSum > 0
          ? Math.round((weightedRatingSum / ratingCountSum) * 100) / 100
          : 0;

      // Contributed-but-not-owned counts per kind: the same set as
      // /ugc/browse?contributorOnly=true. Counted in the DB since we only need
      // totals, not the rows.
      const contributedWhere = {
        contributors: {
          some: {
            gamertag: gamertag,
          },
        },
        author: {
          isNot: {
            gamertag: gamertag,
          },
        },
      };
      const [contributedMaps, contributedModes, contributedPrefabs] =
        await Promise.all([
          prisma.ugc.count({
            where: { ...contributedWhere, assetKind: assetKind.Map },
          }),
          prisma.ugc.count({
            where: { ...contributedWhere, assetKind: assetKind.Mode },
          }),
          prisma.ugc.count({
            where: { ...contributedWhere, assetKind: assetKind.Prefab },
          }),
        ]);

      set.headers["Cache-Control"] =
        "public, max-age=1800, stale-while-revalidate=60";

      return {
        gamertag: identity.gamertag,
        serviceTag: identity.serviceTag,
        emblemPath: identity.emblemPath,
        xuid: identity.xuid,
        stats: {
          ownedMaps,
          ownedModes,
          ownedPrefabs,
          contributedMaps,
          contributedModes,
          contributedPrefabs,
          playlists: playlistCount,
          totalPlays,
          totalBookmarks,
          averageRating,
          ratedAssetCount,
          firstPublishedAt: firstPublishedAt
            ? firstPublishedAt.toISOString()
            : null,
          lastPublishedAt: lastPublishedAt
            ? lastPublishedAt.toISOString()
            : null,
        },
        featuredThumbnailUrl,
      };
    },
    {
      params: t.Object({
        gamertag: t.String({ minLength: 1 }),
      }),
    },
  );

export enum assetKind {
  Map = 2,
  Prefab = 4,
  Mode = 6,
}

export interface UgcFetchData {
  assetKind?: string; //'Map' | 'Mode' | 'Prefab';
  sort?: string; //'datepublishedutc';
  order?: string; //'desc' | 'asc';
  page?: string; //number
  searchTerm?: string;
}
export interface UgcData {
  AssetId: string;
  AssetVersionId: string;
  Name: string;
  Description: string;
  AssetKind: number; //replace with enumm for map, variant, prefab
  Tags?: string[]; // list of tags, might replace with diff data type
  ThumbnailUrl: string;
  RefrencedAssets?: string[]; //Seems unused but idk???
  OriginalAuthor: string; // of the form "xuid(123123123123)"
  Likes: number;
  Bookmarks: number;
  PlaysRecent: number;
  NumberOfObjects: number;
  DateCreatedUtc: {
    ISO8601Date: Date;
  };

  DateModifiedUtc: {
    ISO8601Date: Date;
  };
  DatePublishedUtc: {
    ISO8601Date: Date;
  };
  HasNodeGraph: boolean;
  ReadOnlyClones: boolean;
  PlaysAllTime: number;
  Contributors: string[]; // of the form "xuid()"
  ParentAssetCount: number;
  AverageRating: number; // float/double
  NumberOfRatings: number;
}
