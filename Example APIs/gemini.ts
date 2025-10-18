/*
Example Gemini API Usage
- This script is used in my actual app.
- You might have to change a few things if you want to use this as an example.
*/

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function enhancePrompt(originalPrompt: string, category?: string): Promise<string> {
  const enhancePromptText = `(REDACTED FOR PRIVACY)`;

  try {
    const response = await generateWithRetry(enhancePromptText, "", 2, 500);
    return response?.trim() || "Failed to enhance prompt";
  } catch (error) {
    console.error("Error enhancing prompt:", error);
    throw new Error("Failed to enhance prompt");
  }
}

async function generateWithRetry(
  prompt: string,
  systemPrompt: string,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<string> {
  const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"];

  for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
    const model = models[modelIndex];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `Attempting generation with ${model}, attempt ${attempt + 1}`,
        );

        const response = await ai.models.generateContent({
          model: model,
          config: {
            systemInstruction: systemPrompt,
          },
          contents: prompt,
        });

        const generatedContent = response.text;
        if (!generatedContent) {
          throw new Error("No content generated from AI");
        }

        console.log(
          `Successfully generated with ${model} on attempt ${attempt + 1}`,
        );
        return generatedContent;
      } catch (error: any) {
        const isOverloadedError =
          error?.status === 503 ||
          (error?.message && error.message.includes("overloaded")) ||
          (error?.message && error.message.includes("UNAVAILABLE"));

        console.log(
          `Error with ${model} on attempt ${attempt + 1}:`,
          error?.message || error,
        );

        if (
          isOverloadedError &&
          (attempt < maxRetries || modelIndex < models.length - 1)
        ) {
          if (attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt);
            console.log(
              `Model ${model} overloaded, waiting ${delay}ms before retry ${attempt + 2}`,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          } else {
            // Try next model
            console.log(`Max retries reached for ${model}, trying next model`);
            break;
          }
        } else {
          // Non-overload error, or final attempt with final model
          if (modelIndex === models.length - 1 && attempt === maxRetries) {
            throw error;
          } else if (!isOverloadedError) {
            // Non-overload error, try next model immediately
            break;
          }
        }
      }
    }
  }

  throw new Error("All models failed after retries");
}

export async function generateEducationalTool(
  prompt: string,
  toolType?: string,
  category?: string,
): Promise<{ html: string; toolDescription: string }> {
  try {
    let toolTypeInstruction = "";
    if (toolType && toolType !== "auto") {
      const toolTypeMap: Record<string, string> = {
        REDACTED: "FOR PRIVACY"
      };

      // If it's a predefined tool type, use the mapped instruction
      if (toolTypeMap[toolType]) {
        toolTypeInstruction = `(REDACTED FOR PRIVACY)`;
      } else {
        // Handle custom tool type names
        toolTypeInstruction = `(REDACTED FOR PRIVACY)`;
      }
    } else {
      toolTypeInstruction =
        "Choose the most appropriate tool type for this request and create it.";
    }

    const systemPrompt = `(REDACTED FOR PRIVACY)`;

    const generatedContent = await generateWithRetry(prompt, systemPrompt);

    // Remove markdown
    let cleanedContent = generatedContent
      .replace(/^```html\n?/i, "")
      .replace(/\n?```$/i, "");

    cleanedContent = cleanedContent
      .replace(/^```\n?/i, "")
      .replace(/\n?```$/i, "");

    if (!cleanedContent.includes("<html") && !cleanedContent.includes("<div")) {
      throw new Error("Generated content does not appear to be valid HTML");
    }

    return { html: cleanedContent, toolDescription: "" };
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error(
      `Failed to generate educational tool: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export async function analyzeImage(
  base64Data: string,
  mimeType: string,
): Promise<string> {
  try {
    const contents = [
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType,
        },
      },
      `(REDACTED FOR PRIVACY)`,
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
    });

    return response.text || "Unable to analyze image";
  } catch (error) {
    console.error("Image analysis error:", error);
    throw new Error(
      `Failed to analyze image: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export async function generateEducationalToolWithFiles(
  prompt: string,
  toolType?: string,
  fileContents?: Array<{
    type: "text" | "image";
    content: string;
    fileName: string;
  }>,
): Promise<{ html: string; toolDescription: string }> {
  try {
    let toolTypeInstruction = "";
    if (toolType && toolType !== "auto") {
      const toolTypeMap: Record<string, string> = {
        REDACTED:
          "FOR PRIVACY",
      };

      if (toolTypeMap[toolType]) {
        toolTypeInstruction = `(REDACTED FOR PRIVACY)`;
      } else {
        // Handle custom tool type names
        toolTypeInstruction = `(REDACTED FOR PRIVACY)`;
      }
    } else {
      toolTypeInstruction =
        "Choose the most appropriate tool type for this request and create it.";
    }

    let fileContext = "";
    if (fileContents && fileContents.length > 0) {
      fileContext =
        "(REDACTED FOR PRIVACY)";
      fileContents.forEach((file, index) => {
        fileContext += `\nFile ${index + 1} (${file.fileName}):\n${file.content}\n`;
      });
      fileContext +=
        "(REDACTED FOR PRIVACY)";
    }

    const systemPrompt = `(REDACTED FOR PRIVACY)`;

    const generatedContent = await generateWithRetry(
      prompt + fileContext,
      systemPrompt,
    );

    let cleanedContent = generatedContent
      .replace(/^```html\n?/i, "")
      .replace(/\n?```$/i, "");
    cleanedContent = cleanedContent
      .replace(/^```\n?/i, "")
      .replace(/\n?```$/i, "");

    if (!cleanedContent.includes("<html") && !cleanedContent.includes("<div")) {
      throw new Error("Generated content does not appear to be valid HTML");
    }

    return { html: cleanedContent, toolDescription: "" };
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error(
      `Failed to generate educational tool: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
