import { Elysia, t } from "elysia";
import prisma from "../prisma";
import { TooManyRequests } from "../lib/errors";
import { rateLimit } from "elysia-rate-limit";
import { cloudflareGenerator } from "../lib/rateLimit";
import { server } from "..";

export const tags = new Elysia()
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
  .get(
    "/tags/search",
    async ({ set, query: { searchTerm, count = 20 } }) => {
      const term = (searchTerm ?? "").trim();

      // Autocomplete for the tag panel. Tags are ranked by how many assets
      // carry them; with a blank term this returns the most popular tags so the
      // panel can show suggestions before the user types. MySQL's default
      // collation makes `contains` a case-insensitive substring match (same as
      // /ugc/browse?searchTerm). The soft-delete middleware doesn't reach into
      // `_count`, so the usage count includes any soft-deleted assets on a tag.
      const results = await prisma.tag.findMany({
        where: term ? { name: { contains: term } } : undefined,
        select: {
          name: true,
          _count: {
            select: { ugc: true },
          },
        },
        orderBy: [{ ugc: { _count: "desc" } }, { name: "asc" }],
        take: count,
      });

      set.headers["Cache-Control"] =
        "public, max-age=1800, stale-while-revalidate=60";

      return {
        tags: results.map((tag) => ({ tag: tag.name, count: tag._count.ugc })),
      };
    },
    {
      query: t.Partial(
        t.Object({
          searchTerm: t.String(),
          count: t.Number({
            minimum: 1,
            maximum: 30,
            default: 20,
          }),
        }),
      ),
    },
  );
