import { Elysia, t } from "elysia";
import { authApp } from "../middleware";
import { load } from "cheerio";
import { getSpartanToken } from "../authTools";
import { prisma } from "../prisma";

export const maps = new Elysia().group("/ugc", (app) => {
  return app
    .get("/asset/:assetId", async ({ params: { assetId } }) => {
      const asset = await prisma.ugc.findUniqueOrThrow({
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

      const filteredAsset: any = {
        ...asset,
        tags: asset.tag.map((t) => t.name),
      };

      filteredAsset.files.fileRelativePaths =
        filteredAsset.files.fileRelativePaths.filter(
          (file: string) => file.endsWith(".jpg") || file.endsWith(".png"),
        );
      delete filteredAsset.tag;

      return filteredAsset;
    })
    .post(
      "/browse",
      async ({
        body: {
          assetKind,
          sort = "publishedAt",
          order = "desc",
          count = 20,
          offset = 0,
          tags,
          searchTerm,
          gamertag,
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
        if (tags && tags.length) {
          whereOptions.tag = {
            some: {
              name: {
                in: tags,
              },
            },
          };
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
            versionId: true,
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

        return { totalCount: totalCount, pageSize: count, assets: assets };

        // const results = {
        //   results: jsonContent.props?.pageProps?.results,
        //   totalPages: jsonContent.props?.pageProps?.totalPages,
        //   totalResults: jsonContent.props?.pageProps?.totalResults,
        //   pageSize: jsonContent.props?.pageProps?.pageSize,
        // };
      },
      {
        body: t.Partial(
          t.Object({
            assetKind: t.Number(),
            sort: t.String({
              default: "publishedAt",
            }),
            order: t.String({
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
            tags: t.Array(t.String(), {
              maxItems: 10,
            }),
            searchTerm: t.String(),
            gamertag: t.String(),
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
