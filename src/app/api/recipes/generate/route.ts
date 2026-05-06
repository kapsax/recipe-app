import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true, dietType: true },
    });

    const { image, images, excludeTitles, uploadBatchId: existingBatchId } = await request.json();
    const preferences = user?.preferences ? JSON.parse(user.preferences) : [];
    const dietType = user?.dietType || "both";

    // Support both single image and multiple images
    const imageList: string[] = images || (image ? [image] : []);
    if (imageList.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    // Build image content blocks
    const imageBlocks = imageList.map((img: string) => {
      const base64Data = img.replace(/^data:image\/\w+;base64,/, "");
      const mediaType = img.match(/^data:(image\/\w+);base64,/)?.[1] || "image/jpeg";
      return {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: base64Data,
        },
      };
    });

    // Diet type instruction
    let dietInstruction = "";
    if (dietType === "veg") {
      dietInstruction = "\nIMPORTANT: Only suggest VEGETARIAN recipes. No meat, fish, or eggs.";
    } else if (dietType === "nonveg") {
      dietInstruction = "\nIMPORTANT: Only suggest NON-VEGETARIAN recipes that include meat, fish, or eggs.";
    }

    // Exclude already generated recipes
    let excludeInstruction = "";
    if (excludeTitles && excludeTitles.length > 0) {
      excludeInstruction = `\nIMPORTANT: Do NOT suggest these recipes that were already generated: ${excludeTitles.join(", ")}. Suggest completely different recipes.`;
    }

    const multiImageNote = imageList.length > 1
      ? `You are looking at ${imageList.length} images of food items/ingredients. Consider ALL items across ALL images when suggesting recipes. The recipes should use a combination of ingredients from different images.`
      : "Analyze this food image carefully. Identify ALL the food items/ingredients visible in the image.";

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content: [
            ...imageBlocks,
            {
              type: "text",
              text: `${multiImageNote}

Based on the items you see, suggest 3 COMPLETE, AUTHENTIC recipes that incorporate these visible ingredients. These should be real, well-known recipes (as you'd find on popular cooking websites) — not improvised combinations.

The recipes must be COMPLETE with ALL ingredients needed (including spices, oils, and basics). Separately list which ingredients from the full recipe are NOT visible in the image as "missingItems" — these are items the user will need to buy.

The user prefers these cuisines: ${preferences.join(", ") || "any"}.${dietInstruction}${excludeInstruction}

Return ONLY valid JSON (no markdown, no code blocks) in this exact format:
[
  {
    "title": "Recipe Name in English (use the authentic/popular name)",
    "titleHindi": "Recipe Name in Hindi (Devanagari script)",
    "description": "Detailed 2-3 sentence description explaining the dish, its origin, taste profile, and what makes it special",
    "descriptionHindi": "Same description in Hindi (Devanagari script)",
    "time": "30 mins",
    "calories": 450,
    "isVeg": true,
    "ingredients": ["ingredient 1 - exact quantity (e.g., Onions - 2 medium, finely chopped)", "ingredient 2 - exact quantity"],
    "steps": ["Step 1: Detailed instruction with temperature, timing, and visual cues (e.g., 'Heat 2 tbsp oil in a heavy-bottomed pan over medium heat until shimmering')", "Step 2: Next instruction with tips"],
    "stepsHindi": ["Step 1 in Hindi (Devanagari script) with same detail level", "Step 2 in Hindi"],
    "missingItems": ["items from ingredients list that are NOT visible in the image"],
    "allergies": ["gluten", "dairy", "nuts"]
  }
]

IMPORTANT RULES:
1. Recipes should be REAL, AUTHENTIC, well-known dishes — not random combinations. Think popular recipes from reputable sources.
2. The "ingredients" list must be COMPLETE — include everything needed to cook the dish (oils, spices, salt, garnish, etc.) with precise quantities.
3. "missingItems" should list items from "ingredients" that are NOT visible in the uploaded image. The user needs to buy these.
4. Steps should be extremely detailed: include exact temperatures, timing, visual cues (e.g., "until golden brown"), and pro tips.
5. Include ALL common allergens present in the recipe: gluten, dairy, nuts, soy, eggs, shellfish, fish, sesame, mustard.
6. Calorie counts should be realistic per serving.
7. Provide Hindi translations in Devanagari script for title, description, and steps.
8. Each recipe should have at least 5-8 detailed steps.`,
            },
          ],
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      );
    }

    let recipes;
    try {
      recipes = JSON.parse(textContent.text);
    } catch {
      const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          recipes = JSON.parse(jsonMatch[0]);
        } catch {
          let fixedJson = jsonMatch[0];
          const openBraces = (fixedJson.match(/{/g) || []).length;
          const closeBraces = (fixedJson.match(/}/g) || []).length;
          const openBrackets = (fixedJson.match(/\[/g) || []).length;
          const closeBrackets = (fixedJson.match(/]/g) || []).length;
          fixedJson = fixedJson.replace(/,\s*"[^"]*"?\s*:?\s*[^,}\]]*$/, "");
          for (let i = 0; i < openBraces - closeBraces; i++) fixedJson += "}";
          for (let i = 0; i < openBrackets - closeBrackets; i++) fixedJson += "]";
          try {
            recipes = JSON.parse(fixedJson);
          } catch {
            console.error("Failed to parse even after fix attempt:", textContent.text.slice(0, 500));
            return NextResponse.json(
              { error: "Failed to parse recipe suggestions. Please try again." },
              { status: 500 }
            );
          }
        }
      } else {
        return NextResponse.json(
          { error: "Failed to parse recipe suggestions" },
          { status: 500 }
        );
      }
    }

    if (!Array.isArray(recipes)) {
      recipes = [recipes];
    }

    const uploadBatchId = existingBatchId || `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const recipesWithImages = recipes.map((recipe: Record<string, unknown>, index: number) => {
      const title = (recipe.title as string).toLowerCase();
      const keywords = title
        .replace(/[^a-z\s]/g, "")
        .split(" ")
        .filter((w) => w.length > 3)
        .slice(0, 2)
        .join(",");
      const query = keywords || "food,dish";
      const aiImageUrl = `https://loremflickr.com/600/400/${query},food?lock=${Date.now() + index}`;
      return { ...recipe, aiImageUrl };
    });

    // Store the first image as the representative upload image
    const uploadImage = imageList[0];

    const savedRecipes = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recipesWithImages.map((recipe: any) =>
        prisma.recipe.create({
          data: {
            userId,
            title: recipe.title,
            titleHindi: recipe.titleHindi || null,
            description: recipe.description,
            descriptionHindi: recipe.descriptionHindi || null,
            time: recipe.time,
            calories: recipe.calories,
            isVeg: recipe.isVeg,
            ingredients: JSON.stringify(recipe.ingredients),
            steps: JSON.stringify(recipe.steps),
            stepsHindi: recipe.stepsHindi
              ? JSON.stringify(recipe.stepsHindi)
              : null,
            missingItems: recipe.missingItems?.length
              ? JSON.stringify(recipe.missingItems)
              : null,
            allergies: recipe.allergies?.length
              ? JSON.stringify(recipe.allergies)
              : null,
            imageUrl: uploadImage,
            aiImageUrl: recipe.aiImageUrl || null,
            uploadBatchId,
          },
        })
      )
    );

    return NextResponse.json({ recipes: savedRecipes, uploadBatchId });
  } catch (error) {
    console.error("Recipe generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate recipes. Please try again." },
      { status: 500 }
    );
  }
}
