-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Room" (
    "host" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "oppponent" TEXT,
    "started" BOOLEAN NOT NULL DEFAULT false,
    "scoreMax" INTEGER NOT NULL DEFAULT 10,
    "score0" INTEGER NOT NULL DEFAULT 0,
    "score1" INTEGER NOT NULL DEFAULT 0,
    "winner" TEXT
);
INSERT INTO "new_Room" ("createdAt", "host", "id", "name", "oppponent", "score0", "score1", "started", "winner") SELECT "createdAt", "host", "id", "name", "oppponent", "score0", "score1", "started", "winner" FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
