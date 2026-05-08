import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 30;

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { recipeId, title, isVeg } = await request.json();
    if (!recipeId || !title) {
      return Response.json({ error: "Missing recipeId or title" }, { status: 400 });
    }

    const prompt = `Generate a beautiful, appetizing food photography image of "${title}".
The dish should be ${isVeg ? "vegetarian" : "non-vegetarian"}, beautifully plated on a clean plate,
shot from a 45-degree angle with soft natural lighting, shallow depth of field,
on a rustic wooden table with minimal garnish. Professional food photography style.
No text, no watermarks, no people.`;

    // Try Gemini generateContent with image output first, fall back to Imagen
    let dataUrl: string | null = null;

    try {
      const response = await genai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: prompt,
        config: {
          responseModalities: ["IMAGE", "TEXT"],
        },
      });
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || "image/png";
          dataUrl = `data:${mime};base64,${part.inlineData.data}`;
          break;
        }
      }
    } catch {
      // Gemini image model not available, try Imagen
    }

    if (!dataUrl) {
      try {
        const response = await genai.models.generateImages({
          model: "imagen-4.0-fast-generate-001",
          prompt,
          config: { numberOfImages: 1 },
        });
        const image = response.generatedImages?.[0];
        if (image?.image?.imageBytes) {
          dataUrl = `data:image/png;base64,${image.image.imageBytes}`;
        }
      } catch {
        // Imagen not available either
      }
    }

    if (!dataUrl) {
      return Response.json({ error: "Image generation not available on free plan" }, { status: 402 });
    }

    // Update recipe with generated image
    await prisma.recipe.update({
      where: { id: recipeId },
      data: { aiImageUrl: dataUrl },
    });

    return Response.json({ imageUrl: dataUrl });
  } catch (error) {
    console.error("Image generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Image generation failed: ${message}` }, { status: 500 });
  }
}
