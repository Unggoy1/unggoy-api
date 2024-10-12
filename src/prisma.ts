import { Prisma, PrismaClient } from "@prisma/client";
// import { createSoftDeleteMiddleware } from "prisma-soft-delete-middleware";

// Initialize the Prisma Client
const client = new PrismaClient();

// Apply the soft delete middleware
// client.$use(
//   createSoftDeleteMiddleware({
//     models: {
//       Ugc: {
//         field: "deletedAt",
//         createValue: (deleted) => {
//           if (deleted) return new Date();
//           return null;
//         },
//       },
//     },
//   }),
// );

// Extend the Prisma Client
const prisma = client.$extends({
  name: "findManyAndCount",
  model: {
    $allModels: {
      findManyAndCount<Model, Args>(
        this: Model,
        args: Prisma.Exact<Args, Prisma.Args<Model, "findMany">>,
      ): Promise<[Prisma.Result<Model, Args, "findMany">, number]> {
        return prisma.$transaction([
          (this as any).findMany(args),
          (this as any).count({ where: (args as any).where }),
        ]) as any;
      },
    },
  },
});

export default prisma;
