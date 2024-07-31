-- AddForeignKey
ALTER TABLE `Ugc` ADD CONSTRAINT `Ugc_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `Contributor`(`xuid`) ON DELETE RESTRICT ON UPDATE CASCADE;
