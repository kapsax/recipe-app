import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { recipeId, email } = await request.json();

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
  });

  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  // In production, you'd use a service like SendGrid/Resend here.
  // For local testing, we'll just log and return success.
  console.log(`Sharing recipe "${recipe.title}" with ${email}`);
  console.log(`Recipe details:`, {
    title: recipe.title,
    description: recipe.description,
    time: recipe.time,
    calories: recipe.calories,
    isVeg: recipe.isVeg,
    ingredients: JSON.parse(recipe.ingredients),
    steps: JSON.parse(recipe.steps),
  });

  return NextResponse.json({
    success: true,
    message: `Recipe shared with ${email} (logged to console for local testing)`,
  });
}
