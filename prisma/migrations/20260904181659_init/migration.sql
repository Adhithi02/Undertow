-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "lastVisit" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThesisSnapshot" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "signals" JSONB NOT NULL,

    CONSTRAINT "ThesisSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_userId_symbol_key" ON "WatchlistItem"("userId", "symbol");

-- CreateIndex
CREATE INDEX "ThesisSnapshot_symbol_fetchedAt_idx" ON "ThesisSnapshot"("symbol", "fetchedAt");

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
