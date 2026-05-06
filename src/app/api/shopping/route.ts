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
  const items = await prisma.shoppingItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  const { items, recipeId } = await request.json();

  const created = await Promise.all(
    (items as string[]).map((name) =>
      prisma.shoppingItem.create({
        data: { userId, name, recipeId: recipeId || null },
      })
    )
  );
  return NextResponse.json(created);
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, checked } = await request.json();
  const item = await prisma.shoppingItem.update({
    where: { id },
    data: { checked },
  });
  return NextResponse.json(item);
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  const { id, clearChecked } = await request.json();

  if (clearChecked) {
    await prisma.shoppingItem.deleteMany({
      where: { userId, checked: true },
    });
  } else if (id) {
    await prisma.shoppingItem.delete({ where: { id } });
  }
  return NextResponse.json({ success: true });
}
