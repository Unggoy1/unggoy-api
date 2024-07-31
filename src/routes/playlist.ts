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
        body: { name, description, isPrivate, thumbnail, assetId },
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
            ugc: {
              connect: {
                assetId,
              },
            },
          },
        });

        return playlist;
      },
      {
        body: t.Object({
          name: t.String(),
          description: t.String(),
          isPrivate: t.Boolean(),
          thumbnail: t.String(),
          assetId: t.String({
            format: "uuid",
          }),
        }),
      },
    )
    .post(
      "/:playlistId/asset/:assetId",
      async ({ user, session, params: { playlistId, assetId } }) => {
        if (!user || !session) {
          return new Response(null, {
            status: 401,
          });
        }
        console.log(user);
        let playlist = await prisma.playlist.findFirst({
          where: {
            userId: user.id,
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

        playlist = await prisma.playlist.update({
          where: {
            id: playlistId,
          },
          data: {
            ugc: {
              connect: {
                assetId,
              },
            },
          },
        });

        return playlist;
      },
      {
        params: t.Object({
          playlistId: t.String({
            format: "uuid",
          }),
          assetId: t.String({
            format: "uuid",
          }),
        }),
      },
    )
    .delete(
      "/:playlistId/asset/:assetId",
      async ({ user, session, params: { playlistId, assetId } }) => {
        if (!user || !session) {
          console.log(user);
          console.log(session);
          console.log("here");
          return new Response(null, {
            status: 401,
          });
        }
        console.log("nothere");
        console.log(user);
        let playlist = await prisma.playlist.findFirst({
          where: {
            userId: user.id,
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

        playlist = await prisma.playlist.update({
          where: {
            id: playlistId,
          },
          data: {
            ugc: {
              disconnect: {
                assetId,
              },
            },
          },
        });

        return playlist;
      },
      {
        params: t.Object({
          playlistId: t.String({
            format: "uuid",
          }),
          assetId: t.String({
            format: "uuid",
          }),
        }),
      },
    )
    .get(
      "/:playlistId",
      async ({
        user,
        session,
        params: { playlistId },
        query: {
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
        // if (!user || !session) {
        //   return new Response(null, {
        //     status: 401,
        //   });
        // }
        //TODO: Watch and do tests to see if this should be removed and the authentication check just happens after getting all the data to return
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

        const whereOptions: any = {
          playlist: {
            some: {
              id: playlistId,
            },
          },
        };

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
            playlist: true,
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
        console.log(totalCount);
        console.log(data.length);
        const assets = data.map((asset) => {
          return {
            ...asset,
            tags: asset.tag.map((t) => t.name),
            tag: undefined,
          };
        });

        return {
          totalCount: totalCount,
          pageSize: count,
          assets: assets,
          playlist: playlist,
        };
      },
      {
        query: t.Partial(
          t.Object({
            assetKind: t.Numeric(),
            sort: t.String({
              default: "publishedAt",
            }),
            order: t.String({
              default: "desc",
            }),
            count: t.Numeric({
              minimum: 1,
              maximum: 30,
              default: 20,
            }),
            offset: t.Numeric({
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
    )
    .put(
      "/:playlistId/",
      async ({
        user,
        session,
        params: { playlistId },
        body: { name, description, isPrivate, thumbnail },
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
      },
      {
        params: t.Object({
          playlistId: t.String({
            format: "uuid",
          }),
        }),
        body: t.Partial(
          t.Object({
            name: t.String(),
            description: t.String(),
            isPrivate: t.Boolean(),
            thumbnail: t.String(),
          }),
        ),
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
      {
        params: t.Object({
          playlistId: t.String({
            format: "uuid",
          }),
        }),
      },
    )
    .post(
      "/browse",
      async ({
        user,
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
        if (gamertag) {
        } else {
          whereOptions.private = false;
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
