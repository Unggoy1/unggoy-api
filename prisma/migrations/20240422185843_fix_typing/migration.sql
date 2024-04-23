/*
  Warnings:

  - You are about to alter the column `readOnlyClones` on the `Ugc` table. The data in that column could be lost. The data in that column will be cast from `UnsignedTinyInt` to `TinyInt`.

*/
-- AlterTable
ALTER TABLE `Ugc` MODIFY `readOnlyClones` BOOLEAN NOT NULL;
