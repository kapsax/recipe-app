import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

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

  const ingredients = JSON.parse(recipe.ingredients) as string[];
  const steps = JSON.parse(recipe.steps) as string[];
  const allergies = recipe.allergies ? (JSON.parse(recipe.allergies) as string[]) : [];
  const missingItems = recipe.missingItems ? (JSON.parse(recipe.missingItems) as string[]) : [];

  const allergyHtml = allergies.length > 0
    ? `<div style="margin-top:16px;padding:12px;background:#fef2f2;border-radius:8px;"><strong style="color:#dc2626;">Allergy Warnings:</strong> ${allergies.map(a => a.toUpperCase()).join(", ")}</div>`
    : "";

  const missingHtml = missingItems.length > 0
    ? `<div style="margin-top:16px;padding:12px;background:#fffbeb;border-radius:8px;"><strong style="color:#d97706;">Missing Items:</strong><ul style="margin:8px 0 0 0;">${missingItems.map(i => `<li>${i}</li>`).join("")}</ul></div>`
    : "";

  const emailHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:linear-gradient(135deg,#f97316,#ef4444);padding:24px;border-radius:12px 12px 0 0;color:white;">
        <h1 style="margin:0;font-size:24px;">RecipeAI</h1>
        <p style="margin:8px 0 0;opacity:0.9;">${session.user.name || "Someone"} shared a recipe with you!</p>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
        ${recipe.aiImageUrl ? `<img src="${recipe.aiImageUrl}" alt="${recipe.title}" style="width:100%;max-height:250px;object-fit:cover;border-radius:8px;margin-bottom:16px;" />` : ""}
        <h2 style="color:#1f2937;margin:0 0 8px;">${recipe.title}</h2>
        <p style="color:#6b7280;margin:0 0 16px;">${recipe.description}</p>
        <div style="display:flex;gap:16px;margin-bottom:16px;color:#6b7280;font-size:14px;">
          <span>⏱ ${recipe.time}</span>
          <span>🔥 ${recipe.calories} kcal</span>
          <span>${recipe.isVeg ? "🥬 Vegetarian" : "🍗 Non-Vegetarian"}</span>
        </div>
        ${allergyHtml}
        <h3 style="color:#1f2937;margin-top:20px;">Ingredients</h3>
        <ul style="color:#374151;line-height:1.8;">
          ${ingredients.map(i => `<li>${i}</li>`).join("")}
        </ul>
        ${missingHtml}
        <h3 style="color:#1f2937;margin-top:20px;">Instructions</h3>
        <ol style="color:#374151;line-height:1.8;">
          ${steps.map(s => `<li style="margin-bottom:8px;">${s}</li>`).join("")}
        </ol>
        <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:12px;">
          Shared via RecipeAI
        </div>
      </div>
    </div>
  `;

  if (resend) {
    try {
      await resend.emails.send({
        from: "RecipeAI <onboarding@resend.dev>",
        to: email,
        subject: `${session.user.name || "Someone"} shared a recipe: ${recipe.title}`,
        html: emailHtml,
      });
      return NextResponse.json({ success: true, message: `Recipe shared with ${email}` });
    } catch (error) {
      console.error("Email send error:", error);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }
  }

  // Fallback: open mailto link on client side
  return NextResponse.json({
    success: true,
    fallback: true,
    mailto: `mailto:${email}?subject=${encodeURIComponent(`Check out this recipe: ${recipe.title}`)}&body=${encodeURIComponent(`${recipe.title}\n\n${recipe.description}\n\nTime: ${recipe.time}\nCalories: ${recipe.calories} kcal\n${recipe.isVeg ? "Vegetarian" : "Non-Vegetarian"}\n\nIngredients:\n${ingredients.map((i, idx) => `${idx + 1}. ${i}`).join("\n")}\n\nSteps:\n${steps.map((s, idx) => `${idx + 1}. ${s}`).join("\n")}\n\nShared via RecipeAI`)}`,
  });
}
