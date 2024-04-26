/*
  Warnings:

  - A unique constraint covering the columns `[assetKind]` on the table `WaypointSync` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `WaypointSync_assetKind_key` ON `WaypointSync`(`assetKind`);
