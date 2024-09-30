import { Elysia, t } from "elysia";
import { authApp } from "../middleware";
import prisma from "../prisma";
import { Forbidden, NotFound, Unauthorized } from "../lib/errors";

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
          throw new Unauthorized();
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

        const sortOptions: any =
          sort === "favorites"
            ? { favoritedBy: { _count: "desc" } }
            : { [sort]: order };

        const [data, totalCount] = await prisma.playlist.findManyAndCount({
          where: whereOptions,
          orderBy: sortOptions,
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
          throw new Unauthorized();
        }
        let playlist = await prisma.playlist.findUnique({
          where: {
            assetId: assetId,
          },
        });
        if (!playlist) {
          throw new NotFound();
        }
        if (playlist.private && playlist.userId !== user.id) {
          throw new Forbidden();
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
          throw new Unauthorized();
        }
        let playlist = await prisma.playlist.findUnique({
          where: {
            assetId: assetId,
          },
        });
        if (!playlist) {
          throw new NotFound();
        }
        if (playlist.private && playlist.userId !== user.id) {
          throw new Forbidden();
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
