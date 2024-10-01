import { Elysia } from "elysia";
import { authApp } from "../middleware";
import prisma from "../prisma";
import { Unauthorized, NotFound } from "../lib/errors";
export const user = new Elysia().use(authApp).get("/user", async (context) => {
  if (!context.user) {
    throw new Unauthorized();
  }
  const user = await prisma.user.findUnique({
    where: {
      id: context.user.id,
    },
    include: {
      Playlist: {
        select: {
          assetId: true,
          name: true,
        },
      },
    },
  });
  if (!user) {
    throw new NotFound();
  }
  return user;
});
