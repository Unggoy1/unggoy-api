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
            recommendedOnly = false,
          },
        }) => {
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
            whereOptions.tag = {
              some: {
                name: {
                  in: [tags],
                },
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
            } else {
              whereOptions.contributors = {
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
              recommendedOnly: t.BooleanString({
                default: false,
              }),
            }),
          ),
        },
      );
  });

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
