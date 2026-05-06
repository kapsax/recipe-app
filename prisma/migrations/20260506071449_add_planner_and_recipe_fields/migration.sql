-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN "allergies" TEXT;
ALTER TABLE "Recipe" ADD COLUMN "descriptionHindi" TEXT;
ALTER TABLE "Recipe" ADD COLUMN "missingItems" TEXT;
ALTER TABLE "Recipe" ADD COLUMN "stepsHindi" TEXT;
ALTER TABLE "Recipe" ADD COLUMN "titleHindi" TEXT;

-- CreateTable
CREATE TABLE "MealPlanner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    CONSTRAINT "MealPlanner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MealPlanner_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MealPlanner_userId_day_mealType_key" ON "MealPlanner"("userId", "day", "mealType");
