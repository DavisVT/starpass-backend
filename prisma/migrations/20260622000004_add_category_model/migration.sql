-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateTable
CREATE TABLE "_CategoryToCreator" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_CategoryToCreator_AB_unique" ON "_CategoryToCreator"("A", "B");

-- CreateIndex
CREATE INDEX "_CategoryToCreator_B_index" ON "_CategoryToCreator"("B");

-- AddForeignKey
ALTER TABLE "_CategoryToCreator" ADD CONSTRAINT "_CategoryToCreator_A_fkey" FOREIGN KEY ("A") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToCreator" ADD CONSTRAINT "_CategoryToCreator_B_fkey" FOREIGN KEY ("B") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;