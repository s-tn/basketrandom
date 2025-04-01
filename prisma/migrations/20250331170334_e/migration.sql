-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Socket" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'lobby',
    CONSTRAINT "Socket_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Socket" ("id", "roomId") SELECT "id", "roomId" FROM "Socket";
DROP TABLE "Socket";
ALTER TABLE "new_Socket" RENAME TO "Socket";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
