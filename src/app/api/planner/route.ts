import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const planner = await prisma.mealPlanner.findMany({
    where: { userId },
    include: { recipe: true },
  });

  return NextResponse.json(planner);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { recipeId, day, mealType } = await request.json();

  const entry = await prisma.mealPlanner.upsert({
    where: {
      userId_day_mealType: { userId, day, mealType },
    },
    update: { recipeId },
    create: { userId, recipeId, day, mealType },
    include: { recipe: true },
  });

  return NextResponse.json(entry);
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { day, mealType } = await request.json();

  await prisma.mealPlanner.deleteMany({
    where: { userId, day, mealType },
  });

  return NextResponse.json({ success: true });
}
