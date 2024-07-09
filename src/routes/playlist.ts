import { Elysia, t } from "elysia";
import { authApp } from "../middleware";
import { load } from "cheerio";
import { getSpartanToken } from "../authTools";
import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";

export const playlists = new Elysia().group("/playlist", (app) => {
  return app
    .use(authApp)
    .post(
      "/",
      async ({
        user,
        session,
        params: { name, description, isPrivate, thumbnail },
      }) => {
        if (!user || !session) {
          return new Response(null, {
            status: 401,
          });
        }
        let playlist = await prisma.playlist.findFirst({
          where: {
            userId: user.id,
            name: name,
          },
        });
        if (playlist) {
          return new Response(null, {
            status: 409,
          });
        }

        playlist = await prisma.playlist.create({
          data: {
            name: name,
            description: description,
            private: isPrivate,
            thumbnail: thumbnail,
            userId: user.id,
          },
        });

        return playlist;
      },
    )
    .get("/:playlistId", async ({ user, session, params: { playlistId } }) => {
      // if (!user || !session) {
      //   return new Response(null, {
      //     status: 401,
      //   });
      // }
      let playlist = await prisma.playlist.findUnique({
        where: {
          id: playlistId,
        },
      });
      if (!playlist) {
        return new Response(null, {
          status: 404,
        });
      }

      if (playlist.private && (!user || playlist.userId !== user.id)) {
        return new Response(null, {
          status: 403,
        });
      }

      return playlist;
    })
    .put(
      "/",
      async ({
        user,
        session,
        params: { playlistId, name, description, isPrivate, thumbnail },
      }) => {
        if (!user || !session) {
          return new Response(null, {
            status: 401,
          });
        }

        const playlist = await prisma.playlist.findUnique({
          where: {
            id: playlistId,
          },
        });
        if (!playlist) {
          return new Response(null, {
            status: 404,
          });
        }
        if (playlist.userId !== user.id) {
          return new Response(null, {
            status: 403,
          });
        }
        try {
          const updateData = {
            name: name,
            description: description,
            private: isPrivate,
          };
          const playlist = await prisma.playlist.update({
            where: { id: playlistId },
            data: { ...updateData },
          });

          return playlist;
        } catch (error) {
          return new Response(null, {
            status: 404,
          });
        }

        return;
      },
    )
    .delete(
      "/:playlistId",
      async ({ user, session, params: { playlistId } }) => {
        if (!user || !session) {
          return new Response(null, {
            status: 401,
          });
        }

        const playlist = await prisma.playlist.findUnique({
          where: {
            id: playlistId,
          },
        });
        if (!playlist) {
          return new Response(null, {
            status: 404,
          });
        }
        if (playlist.userId !== user.id) {
          return new Response(null, {
            status: 403,
          });
        }
        try {
          await prisma.playlist.delete({
            where: { id: playlistId },
          });
        } catch (error) {
          return new Response(null, {
            status: 404,
          });
        }

        return;
      },
    )
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
