/*
  Warnings:

  - You are about to drop the column `refreshTokenExpiresAt` on the `Oauth` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Oauth` DROP COLUMN `refreshTokenExpiresAt`;
