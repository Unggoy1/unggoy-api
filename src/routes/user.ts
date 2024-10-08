import { Elysia } from "elysia";
import { authApp } from "../middleware";
import prisma from "../prisma";
import { Unauthorized, NotFound, TooManyRequests } from "../lib/errors";
import { rateLimit } from "elysia-rate-limit";
export const user = new Elysia()
  .use(
    rateLimit({
      scoping: "scoped",
      errorResponse: new TooManyRequests(),
      max: 5000,
    }),
  )
  .use(authApp)
  .get("/user", async (context) => {
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
    context.set.headers["Cache-Control"] = "private, no-store, max-age=0";
    return user;
  });
