import { Elysia, t } from "elysia";
import { authApp } from "../middleware";
import prisma from "../prisma";

export const favorites = new Elysia().group("/favorites", (app) => {
  return app
    .use(authApp)
    .get(
      "/",
      async ({
        user,
        session,
        query: {
          sort = "name",
          order = "desc",
          count = 20,
          offset = 0,
          searchTerm,
          gamertag,
        },
      }) => {
        if (!user || !session) {
          return new Response(null, {
            status: 401,
          });
        }
        const whereOptions: any = {
          favoritedBy: {
            some: {
              id: user.id,
            },
          },
        };

        if (searchTerm) {
          whereOptions.name = {
            contains: searchTerm,
          };
        }
        if (gamertag) {
        } else {
          whereOptions.private = false;
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
    .post(
      "/:assetId",
      async ({ user, session, params: { assetId } }) => {
        if (!user || !session) {
          return new Response(null, {
            status: 401,
          });
        }
        let playlist = await prisma.playlist.findUnique({
          where: {
            assetId: assetId,
          },
        });
        if (!playlist) {
          return new Response(null, {
            status: 404,
          });
        }
        if (playlist.private && playlist.userId !== user.id) {
          return new Response(null, {
            status: 403,
          });
        }

        let userData = await prisma.user.update({
          where: {
            id: user.id,
          },
          data: {
            favorites: {
              connect: {
                assetId,
              },
            },
          },
          omit: {
            oid: true,
            xuid: true,
            serviceTag: true,
            emblemPath: true,
          },

          include: {
            favorites: true,
          },
        });

        return userData;
      },
      {
        params: t.Object({
          assetId: t.String({
            format: "uuid",
          }),
        }),
      },
    )
    .delete(
      "/:assetId",
      async ({ user, session, params: { assetId } }) => {
        if (!user || !session) {
          return new Response(null, {
            status: 401,
          });
        }
        let playlist = await prisma.playlist.findUnique({
          where: {
            assetId: assetId,
          },
        });
        if (!playlist) {
          return new Response(null, {
            status: 404,
          });
        }
        if (playlist.private && playlist.userId !== user.id) {
          return new Response(null, {
            status: 403,
          });
        }

        let userData = await prisma.user.update({
          where: {
            id: user.id,
          },
          data: {
            favorites: {
              disconnect: {
                assetId,
              },
            },
          },
          omit: {
            oid: true,
            xuid: true,
            serviceTag: true,
            emblemPath: true,
          },
          include: {
            favorites: true,
          },
        });

        return userData;
      },
      {
        params: t.Object({
          assetId: t.String({
            format: "uuid",
          }),
        }),
      },
    );
});
