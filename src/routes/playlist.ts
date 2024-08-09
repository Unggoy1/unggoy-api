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
            thumbnailUrl: thumbnail,
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
        let playlist = await prisma.playlist.findUnique({
          where: {
            userId: user.id,
            assetId: playlistId,
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
            assetId: playlistId,
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
          return new Response(null, {
            status: 401,
          });
        }
        let playlist = await prisma.playlist.findUnique({
          where: {
            userId: user.id,
            assetId: playlistId,
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
            assetId: playlistId,
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
          ownerOnly,
        },
      }) => {
        console.log("calling playlisst get ");
        let includeOptions = {};
        if (user && session) {
          console.log("we have the user");
          includeOptions = {
            favoritedBy: {
              where: {
                id: user.id,
              },
              select: {
                id: true,
                username: true,
              },
            },
          };
        }
        let playlist = await prisma.playlist.findUnique({
          where: {
            assetId: playlistId,
          },
          include: includeOptions,
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
              assetId: playlistId,
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
            tags: t.String(),
            searchTerm: t.String(),
            gamertag: t.String(),
            ownerOnly: t.Boolean(),
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
            assetId: playlistId,
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
            where: { assetId: playlistId },
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
            assetId: playlistId,
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
            where: { assetId: playlistId },
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
    .get(
      "/browse",
      async ({
        user,
        query: {
          sort = "name",
          order = "desc",
          count = 20,
          offset = 0,
          searchTerm,
          gamertag,
        },
      }) => {
        const whereOptions: any = {
          private: false,
        };

        if (searchTerm) {
          whereOptions.name = {
            contains: searchTerm,
          };
        }
        if (gamertag) {
          whereOptions.user = {
            username: gamertag,
          };
        }

        const [data, totalCount] = await prisma.playlist.findManyAndCount({
          where: whereOptions,

          orderBy: {
            [sort]: order,
          },
          take: count,
          skip: offset,
        });

        return { totalCount: totalCount, pageSize: count, assets: data };
      },
      {
        query: t.Partial(
          t.Object({
            sort: t.String({
              default: "name",
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
            searchTerm: t.String(),
            gamertag: t.String(),
          }),
        ),
      },
    )
    .get(
      "/me",
      async ({
        user,
        session,
        query: {
          sort = "name",
          order = "desc",
          count = 20,
          offset = 0,
          searchTerm,
        },
      }) => {
        if (!user || !session) {
          return new Response(null, {
            status: 401,
          });
        }

        const whereOptions: any = {
          userId: user.id,
        };

        if (searchTerm) {
          whereOptions.name = {
            contains: searchTerm,
          };
        }

        const [data, totalCount] = await prisma.playlist.findManyAndCount({
          where: whereOptions,

          orderBy: {
            [sort]: order,
          },
          take: count,
          skip: offset,
        });

        return { totalCount: totalCount, pageSize: count, assets: data };
      },
      {
        query: t.Partial(
          t.Object({
            sort: t.String({
              default: "name",
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
            searchTerm: t.String(),
          }),
        ),
      },
    );
});
