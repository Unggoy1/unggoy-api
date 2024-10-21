import { Prisma, PrismaClient } from "@prisma/client";
import { createSoftDeleteMiddleware } from "prisma-soft-delete-middleware";

// Initialize the Prisma Client
const client = new PrismaClient();

// Apply the soft delete middleware
client.$use(
  createSoftDeleteMiddleware({
    models: {
      Ugc: {
        field: "deletedAt",
        createValue: (deleted) => {
          if (deleted) return new Date();
          return null;
        },
      },
    },
  }),
);

// First extension: findManyAndCount
const clientWithFindManyAndCount = client.$extends({
  name: "findManyAndCount",
  model: {
    $allModels: {
      findManyAndCount<Model, Args>(
        this: Model,
        args: Prisma.Exact<Args, Prisma.Args<Model, "findMany">>,
      ): Promise<[Prisma.Result<Model, Args, "findMany">, number]> {
        return client.$transaction([
          (this as any).findMany(args),
          (this as any).count({ where: (args as any).where }),
        ]) as any;
      },
    },
  },
});

// Second extension: Decimal conversion for averageRating
const prisma = clientWithFindManyAndCount.$extends({
  name: "decimalConversion",
  result: {
    ugc: {
      averageRating: {
        needs: { averageRating: true },
        compute(ugc) {
          return ugc.averageRating ? ugc.averageRating.toNumber() : null;
        },
      },
    },
  },
});

export default prisma;
