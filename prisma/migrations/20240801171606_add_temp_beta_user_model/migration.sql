-- CreateTable
CREATE TABLE `BetaAccess` (
    `gamertag` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `BetaAccess_gamertag_key`(`gamertag`),
    PRIMARY KEY (`gamertag`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
