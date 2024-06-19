import { Elysia, t } from "elysia";
import { authApp } from "../middleware";
import { load } from "cheerio";
import { getSpartanToken } from "../authTools";
import { prisma } from "../prisma";

export const playlists = new Elysia().group("/playlist", (app) => {
  return app
    .post(
      "/",
      async ({ params: { name, description, isPrivate, thumbnail } }) => {
        return;
      },
    )
    .get("/:playlistId", async ({ params: { playlistId } }) => {
      return;
    })
    .put(
      "/",
      async ({ params: { name, description, isPrivate, thumbnail } }) => {
        return;
      },
    )
    .delete("/:playlistId", async ({ params: { playlistId } }) => {
      return;
    })
    .post(
      "/browse",
      async ({
        body: {
          sort = "name",
          order = "desc",
          count = 20,
          offset = 0,
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
        // if (assetKind) {
        //   whereOptions.assetKind = assetKind;
        // }
        // if (tags && tags.length) {
        //   whereOptions.tag = {
        //     some: {
        //       name: {
        //         in: tags,
        //       },
        //     },
        //   };
        // }

        const [data, totalCount] = await prisma.playlist.findManyAndCount({
          where: whereOptions,

          orderBy: {
            [sort]: order,
          },
          take: count,
          skip: offset,
        });

        return { totalCount: totalCount, pageSize: count, assets: data };

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
            sort: t.String({
              default: "name",
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
            searchTerm: t.String(),
            gamertag: t.String(),
          }),
        ),
      },
    );
});
