-- Additive: daily tour + stops pointing at existing Company rows.

CREATE TABLE "Tour" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tour_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TourStop" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "visitedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TourStop_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tour_date_key" ON "Tour"("date");
CREATE INDEX "Tour_date_idx" ON "Tour"("date");
CREATE UNIQUE INDEX "TourStop_tourId_companyId_key" ON "TourStop"("tourId", "companyId");
CREATE INDEX "TourStop_tourId_order_idx" ON "TourStop"("tourId", "order");

ALTER TABLE "Tour" ADD CONSTRAINT "Tour_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TourStop" ADD CONSTRAINT "TourStop_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TourStop" ADD CONSTRAINT "TourStop_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
