import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { preferences, dietType, onDiet } = await request.json();
  const userId = (session.user as { id: string }).id;

  await prisma.user.update({
    where: { id: userId },
    data: {
      preferences: JSON.stringify(preferences),
      dietType: dietType || "both",
      onDiet: onDiet ?? false,
      onboarded: true,
    },
  });

  return NextResponse.json({ success: true });
}
