import { Prisma } from "@prisma/client";
import prisma from "./prisma";

export const createUserr = async (user: Prisma.UserCreateInput) => {
  // 2 & 3
  return await prisma.user.create({
    data: user,
  });
};
