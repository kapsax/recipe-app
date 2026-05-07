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
      select: { preferences: true, dietType: true, onDiet: true },
    });

    const { images, image, excludeTitles, uploadBatchId: existingBatchId } = await request.json();
    const preferences = user?.preferences ? JSON.parse(user.preferences) : [];
    const dietType = user?.dietType || "both";
    const onDiet = user?.onDiet ?? false;

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

    const dietModeInstruction = onDiet
      ? " The user is on a diet. Prioritize LOW-CALORIE, healthy, light recipes. Prefer grilled, steamed, baked over fried. Keep calories under 400 per serving where possible."
      : "";

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
User prefers: ${preferences.join(", ") || "any"}.${dietInstruction}${dietModeInstruction}${excludeInstruction}

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

    // Curated food photos from Unsplash (direct URLs, always available)
    const FOOD_PHOTOS = [
      "photo-1546069901-ba9599a7e63c", "photo-1567620905732-2d1ec7ab7445",
      "photo-1565299624946-b28f40a0ae38", "photo-1540189549336-e6e99c3679fe",
      "photo-1512621776951-a57141f2eefd", "photo-1482049016688-2d3e1b311543",
      "photo-1504674900247-0877df9cc836", "photo-1493770348161-369560ae357d",
      "photo-1476224203421-9ac39bcb3327", "photo-1455619452474-d2be8b1e70cd",
      "photo-1432139509613-5c4255a78e03", "photo-1473093295043-cdd812d0e601",
      "photo-1490645935967-10de6ba17061", "photo-1498837167922-ddd27525d352",
      "photo-1529042410759-befb1204b468", "photo-1606787366850-de6330128bfc",
      "photo-1547592180-85f173990554", "photo-1563379091339-03b21ab4a4f8",
      "photo-1551183053-bf91a1d81141", "photo-1574484284002-952d92456975",
    ];

    const savedRecipes = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recipes.map((recipe: any, index: number) => {
        // Pick a photo based on title hash for consistency
        const hash = (recipe.title as string).split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
        const photoId = FOOD_PHOTOS[(hash + index) % FOOD_PHOTOS.length];
        const aiImageUrl = `https://images.unsplash.com/${photoId}?w=600&h=400&fit=crop&auto=format`;

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
