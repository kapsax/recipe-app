import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// GET: Load chat history for a recipe
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const recipeId = searchParams.get("recipeId");
  if (!recipeId) {
    return Response.json({ error: "Missing recipeId" }, { status: 400 });
  }

  const messages = await prisma.chatMessage.findMany({
    where: { recipeId },
    orderBy: { createdAt: "asc" },
  });

  return Response.json(messages);
}

// POST: Send a message and get AI response
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { recipeId, message, image, isInitialTip } = await request.json();

    if (!recipeId) {
      return Response.json({ error: "Missing recipeId" }, { status: 400 });
    }

    // Get recipe context
    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!recipe) {
      return Response.json({ error: "Recipe not found" }, { status: 404 });
    }

    const ingredients = recipe.ingredients ? JSON.parse(recipe.ingredients) : [];
    const steps = recipe.steps ? JSON.parse(recipe.steps) : [];
    const allergies = recipe.allergies ? JSON.parse(recipe.allergies) : [];

    const recipeContext = `Recipe: ${recipe.title}
Description: ${recipe.description}
Cook Time: ${recipe.time}
Calories: ${recipe.calories} kcal
Type: ${recipe.isVeg ? "Vegetarian" : "Non-Vegetarian"}
Ingredients: ${ingredients.join(", ")}
Steps: ${steps.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}
Allergies: ${allergies.join(", ") || "None listed"}`;

    // Load previous chat history for context
    const chatHistory = await prisma.chatMessage.findMany({
      where: { recipeId },
      orderBy: { createdAt: "asc" },
      take: 20, // Last 20 messages for context
    });

    // Build messages for Claude
    const systemPrompt = `You are a friendly, knowledgeable cooking assistant helping with a specific recipe. You have deep expertise in cooking techniques, ingredient substitutions, dietary modifications, and food science.

Here is the recipe you're helping with:
${recipeContext}

Guidelines:
- Be concise and helpful. Keep responses to 2-4 sentences unless more detail is needed.
- If the user uploads a photo, analyze it in the context of this recipe (e.g., "does my dish look right?", "what ingredient is this?", "is this done cooking?").
- You can suggest modifications, substitutions, tips, and troubleshooting advice.
- Be encouraging and supportive.`;

    // Build conversation history
    const conversationMessages: Anthropic.MessageParam[] = [];

    for (const msg of chatHistory) {
      if (msg.role === "user") {
        conversationMessages.push({ role: "user", content: msg.content });
      } else if (msg.role === "assistant") {
        conversationMessages.push({ role: "assistant", content: msg.content });
      }
    }

    // Build current user message content
    if (isInitialTip) {
      conversationMessages.push({
        role: "user",
        content: `Give me one interesting, practical cooking tip or pro trick specifically for making ${recipe.title}. Something that would genuinely improve the result. Keep it to 2-3 sentences.`,
      });
    } else {
      const userContent: Anthropic.ContentBlockParam[] = [];

      if (image) {
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const mediaType = image.match(/^data:(image\/\w+);base64,/)?.[1] || "image/jpeg";
        userContent.push({
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: base64Data,
          },
        });
      }

      if (message) {
        userContent.push({ type: "text", text: message });
      }

      conversationMessages.push({ role: "user", content: userContent });

      // Save user message
      await prisma.chatMessage.create({
        data: {
          recipeId,
          role: "user",
          content: message || "[Photo uploaded]",
          imageUrl: image ? "attached" : null, // Don't store full base64
        },
      });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: systemPrompt,
      messages: conversationMessages,
    });

    const textContent = response.content.find((c) => c.type === "text");
    const aiReply = textContent && textContent.type === "text" ? textContent.text : "Sorry, I couldn't generate a response.";

    // Save assistant message
    const savedMessage = await prisma.chatMessage.create({
      data: {
        recipeId,
        role: "assistant",
        content: aiReply,
      },
    });

    // If initial tip, also save the system-generated user prompt
    if (isInitialTip) {
      await prisma.chatMessage.create({
        data: {
          recipeId,
          role: "system",
          content: "tip_request",
        },
      });
    }

    return Response.json({ message: savedMessage });
  } catch (error) {
    console.error("Chat error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Chat failed: ${msg}` }, { status: 500 });
  }
}
