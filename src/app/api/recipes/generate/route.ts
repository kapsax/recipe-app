import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true, dietType: true },
    });

    const { images, image, excludeTitles, uploadBatchId: existingBatchId } = await request.json();
    const preferences = user?.preferences ? JSON.parse(user.preferences) : [];
    const dietType = user?.dietType || "both";

    const imageList: string[] = images || (image ? [image] : []);
    if (imageList.length === 0) {
      return Response.json({ error: "No images provided" }, { status: 400 });
    }

    // Only send the first image to keep request fast
    const imgToAnalyze = imageList[0];
    const base64Data = imgToAnalyze.replace(/^data:image\/\w+;base64,/, "");
    const mediaType = imgToAnalyze.match(/^data:(image\/\w+);base64,/)?.[1] || "image/jpeg";

    let dietInstruction = "";
    if (dietType === "veg") {
      dietInstruction = " Only suggest VEGETARIAN recipes (no meat, fish, or eggs).";
    } else if (dietType === "nonveg") {
      dietInstruction = " Only suggest NON-VEGETARIAN recipes with meat, fish, or eggs.";
    }

    let excludeInstruction = "";
    if (excludeTitles && excludeTitles.length > 0) {
      excludeInstruction = ` Do NOT suggest: ${excludeTitles.join(", ")}.`;
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: base64Data,
              },
            },
            {
              type: "text",
              text: `Identify the food items in this image. Suggest 3 authentic recipes using these ingredients.
User prefers: ${preferences.join(", ") || "any"}.${dietInstruction}${excludeInstruction}

Return ONLY valid JSON array (no markdown):
[{
  "title": "Recipe Name",
  "titleHindi": "Hindi name in Devanagari",
  "description": "2 sentence description",
  "descriptionHindi": "Hindi description in Devanagari",
  "time": "30 mins",
  "calories": 450,
  "isVeg": true,
  "ingredients": ["item - quantity"],
  "steps": ["Step 1: instruction", "Step 2: instruction"],
  "stepsHindi": ["Step 1 Hindi", "Step 2 Hindi"],
  "missingItems": ["items not in image"],
  "allergies": ["gluten", "dairy"]
}]

Rules: Complete ingredient lists with quantities. 5-8 detailed steps. List allergens. Realistic calories.`,
            },
          ],
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return Response.json({ error: "No response from AI" }, { status: 500 });
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
          return Response.json(
            { error: "Failed to parse recipes. Please try again." },
            { status: 500 }
          );
        }
      } else {
        return Response.json(
          { error: "Failed to parse recipes" },
          { status: 500 }
        );
      }
    }

    if (!Array.isArray(recipes)) recipes = [recipes];

    const uploadBatchId = existingBatchId || `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const savedRecipes = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recipes.map((recipe: any, index: number) => {
        const title = (recipe.title as string).toLowerCase();
        const keywords = title.replace(/[^a-z\s]/g, "").split(" ").filter((w: string) => w.length > 3).slice(0, 2).join(",");
        const aiImageUrl = `https://loremflickr.com/600/400/${keywords || "food,dish"},food?lock=${Date.now() + index}`;

        return prisma.recipe.create({
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
            stepsHindi: recipe.stepsHindi ? JSON.stringify(recipe.stepsHindi) : null,
            missingItems: recipe.missingItems?.length ? JSON.stringify(recipe.missingItems) : null,
            allergies: recipe.allergies?.length ? JSON.stringify(recipe.allergies) : null,
            imageUrl: null,
            aiImageUrl,
            uploadBatchId,
          },
        });
      })
    );

    return Response.json({ recipes: savedRecipes, uploadBatchId });
  } catch (error) {
    console.error("Recipe generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: `Failed to generate recipes: ${message}` },
      { status: 500 }
    );
  }
}
