import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  // Validate session and parse input before streaming
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { images, image, excludeTitles, uploadBatchId: existingBatchId } = body;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true, dietType: true },
  });

  const preferences = user?.preferences ? JSON.parse(user.preferences) : [];
  const dietType = user?.dietType || "both";

  const imageList: string[] = images || (image ? [image] : []);
  if (imageList.length === 0) {
    return Response.json({ error: "No images provided" }, { status: 400 });
  }

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

  let dietInstruction = "";
  if (dietType === "veg") {
    dietInstruction = "\nIMPORTANT: Only suggest VEGETARIAN recipes. No meat, fish, or eggs.";
  } else if (dietType === "nonveg") {
    dietInstruction = "\nIMPORTANT: Only suggest NON-VEGETARIAN recipes that include meat, fish, or eggs.";
  }

  let excludeInstruction = "";
  if (excludeTitles && excludeTitles.length > 0) {
    excludeInstruction = `\nIMPORTANT: Do NOT suggest these recipes that were already generated: ${excludeTitles.join(", ")}. Suggest completely different recipes.`;
  }

  const multiImageNote = imageList.length > 1
    ? `You are looking at ${imageList.length} images of food items/ingredients. Consider ALL items across ALL images when suggesting recipes.`
    : "Analyze this food image carefully. Identify ALL the food items/ingredients visible in the image.";

  const promptText = `${multiImageNote}

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
    "ingredients": ["ingredient 1 - exact quantity", "ingredient 2 - exact quantity"],
    "steps": ["Step 1: Detailed instruction", "Step 2: Next instruction"],
    "stepsHindi": ["Step 1 in Hindi (Devanagari script)", "Step 2 in Hindi"],
    "missingItems": ["items from ingredients list NOT visible in image"],
    "allergies": ["gluten", "dairy", "nuts"]
  }
]

IMPORTANT RULES:
1. Recipes should be REAL, AUTHENTIC, well-known dishes.
2. The "ingredients" list must be COMPLETE with precise quantities.
3. "missingItems" should list items from "ingredients" NOT visible in the image.
4. Steps should be detailed with temperatures, timing, and visual cues.
5. Include ALL common allergens: gluten, dairy, nuts, soy, eggs, shellfish, fish, sesame, mustard.
6. Calorie counts should be realistic per serving.
7. Provide Hindi translations in Devanagari script for title, description, and steps.
8. Each recipe should have at least 5-8 detailed steps.`;

  // Stream response back to client to keep connection alive
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        // Send initial heartbeat
        controller.enqueue(encoder.encode("data: {\"status\":\"thinking\"}\n\n"));

        // Call Claude API with streaming
        const stream = anthropic.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8000,
          messages: [
            {
              role: "user",
              content: [
                ...imageBlocks,
                { type: "text", text: promptText },
              ],
            },
          ],
        });

        let fullText = "";
        let chunkCount = 0;

        stream.on("text", (text) => {
          fullText += text;
          chunkCount++;
          // Send periodic progress updates to keep connection alive
          if (chunkCount % 20 === 0) {
            controller.enqueue(encoder.encode("data: {\"status\":\"generating\"}\n\n"));
          }
        });

        const finalMessage = await stream.finalMessage();

        // Use accumulated text or extract from final message
        const textContent = finalMessage.content.find((c) => c.type === "text");
        const responseText = textContent && textContent.type === "text" ? textContent.text : fullText;

        if (!responseText) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "No response from AI" })}\n\n`));
          controller.close();
          return;
        }

        // Parse recipes JSON
        let recipes;
        try {
          recipes = JSON.parse(responseText);
        } catch {
          const jsonMatch = responseText.match(/\[[\s\S]*\]/);
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
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Failed to parse recipe suggestions. Please try again." })}\n\n`));
                controller.close();
                return;
              }
            }
          } else {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Failed to parse recipe suggestions" })}\n\n`));
            controller.close();
            return;
          }
        }

        if (!Array.isArray(recipes)) {
          recipes = [recipes];
        }

        controller.enqueue(encoder.encode("data: {\"status\":\"saving\"}\n\n"));

        const uploadBatchId = existingBatchId || `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const recipesWithImages = recipes.map((recipe: Record<string, unknown>, index: number) => {
          const title = (recipe.title as string).toLowerCase();
          const keywords = title
            .replace(/[^a-z\s]/g, "")
            .split(" ")
            .filter((w: string) => w.length > 3)
            .slice(0, 2)
            .join(",");
          const query = keywords || "food,dish";
          const aiImageUrl = `https://loremflickr.com/600/400/${query},food?lock=${Date.now() + index}`;
          return { ...recipe, aiImageUrl };
        });

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
                imageUrl: null,
                aiImageUrl: recipe.aiImageUrl || null,
                uploadBatchId,
              },
            })
          )
        );

        // Send final result
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ recipes: savedRecipes, uploadBatchId })}\n\n`));
        controller.close();
      } catch (error) {
        console.error("Recipe generation error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: `Failed to generate recipes: ${message}` })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
