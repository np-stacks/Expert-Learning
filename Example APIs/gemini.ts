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
  const enhancePromptText = `
You are an educational tool prompt enhancer. Your job is to take a basic prompt and enhance it to create better, more detailed educational tools.

Take this prompt: "${originalPrompt}"
${category && category !== 'none' ? `Category/Subject: ${category}` : ''}

Note: The prompt if from the App User. If the prompt doesn't make sense, or is too vague, you can make a reasonable assumption about what the user wants.

Enhance it by:
1. Adding specific learning objectives
2. Suggesting appropriate difficulty levels
3. Including interactive elements
4. Making it more engaging and educational
5. Adding context or real-world applications
6. Specifying the target audience if not clear
7. Making prompt more clear and concise
8. Make it less than 500 characters long

Return ONLY the enhanced prompt, nothing else. Keep it concise but much more detailed and educational than the original.
`;

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
        quiz: "Create an interactive quiz with multiple choice questions, immediate feedback, and a score counter.",
        flashcards:
          "Create interactive digital flashcards that users can flip through with click/tap interactions.",
        chart:
          "Create an interactive chart or graph with detailed data visualization.",
        worksheet:
          "Create an interactive worksheet with fillable fields and exercises.",
        timeline:
          "Create an interactive timeline with detailed clickable events and detailed information.",
        game: "Create an educational game with interactive elements and scoring.",
        lecture:
          "Create a interactive slideshow relating to the subject. Allow the user to move between slides, and include detailed information in each slide.",
        diagram:
          "Create an interactive diagram or infographic with detailed and clickable elements.",
        custom:
          "Create a highly customized, advanced educational tool with unique interactive features tailored specifically to the user's request. Use creative and innovative approaches that go beyond standard tool types.",
      };

      // If it's a predefined tool type, use the mapped instruction
      if (toolTypeMap[toolType]) {
        toolTypeInstruction = `Specifically create: ${toolTypeMap[toolType]}`;
      } else {
        // Handle custom tool type names
        toolTypeInstruction = `Specifically create: ${toolType}. Create a highly customized, advanced educational tool with unique interactive features tailored specifically to this tool type and the user's request. Use creative and innovative approaches.`;
      }
    } else {
      toolTypeInstruction =
        "Choose the most appropriate tool type for this request and create it.";
    }

    const systemPrompt = `You are an expert educational app creator. Generate complete, interactive HTML content for educational/study tools.

IMPORTANT REQUIREMENTS:
1. Generate ONLY valid HTML content that can be embedded in an iframe
2. Include all necessary CSS styles inline within <style> tags
3. Include all necessary JavaScript within <script> tags
4. Make the content fully self-contained and interactive
5. Use modern, responsive design with good UX
6. Ensure accessibility with proper ARIA labels and semantic HTML
7. Use vibrant colors and engaging visual elements
8. Make sure all functionality works without external dependencies
9. Create modern and appealing UI
10. Make sure the app is COMPLETE. DO NOT ADD ANY "PLACEHOLDERS"
11. The result will be used for commercial use.
12. Do your best, we want quality.
13. Try your best to fill in stuff such as APIs.
14. There should be no placeholders.

The user wants: ${prompt}
${toolTypeInstruction}
${category && category !== 'none' ? `Category/Subject: ${category}` : ''}

Generate complete HTML that will work immediately when loaded in an iframe.`;

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
      `Analyze this image in detail and describe its key elements, context, subject matter, and any text visible in the image. Focus on educational content that could be used to create learning tools.`,
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
        quiz: "Create an interactive quiz with multiple choice questions, immediate feedback, and a score counter.",
        flashcards:
          "Create interactive digital flashcards that users can flip through with click/tap interactions.",
        chart:
          "Create an interactive chart or graph with detailed data visualization.",
        worksheet:
          "Create an interactive worksheet with fillable fields and exercises.",
        timeline:
          "Create an interactive timeline with detailed clickable events and detailed information.",
        game: "Create an educational game with interactive elements and scoring.",
        lecture:
          "Create a interactive slideshow relating to the subject. Allow the user to move between slides, and include detailed information in each slide.",
        diagram:
          "Create an interactive diagram or infographic with detailed and clickable elements.",
        custom:
          "Create a highly customized, advanced educational tool with unique interactive features tailored specifically to the user's request. Use creative and innovative approaches that go beyond standard tool types.",
      };

      if (toolTypeMap[toolType]) {
        toolTypeInstruction = `Specifically create: ${toolTypeMap[toolType]}`;
      } else {
        // Handle custom tool type names
        toolTypeInstruction = `Specifically create: ${toolType}. Create a highly customized, advanced educational tool with unique interactive features tailored specifically to this tool type and the user's request. Use creative and innovative approaches.`;
      }
    } else {
      toolTypeInstruction =
        "Choose the most appropriate tool type for this request and create it.";
    }

    let fileContext = "";
    if (fileContents && fileContents.length > 0) {
      fileContext =
        "\n\nThe user has also provided the following files for context:\n";
      fileContents.forEach((file, index) => {
        fileContext += `\nFile ${index + 1} (${file.fileName}):\n${file.content}\n`;
      });
      fileContext +=
        "\nUse this file content to create more relevant and personalized educational tools. Incorporate the information from these files into the educational tool you create.";
    }

    const systemPrompt = `You are an expert educational app creator. Generate complete, interactive HTML content for educational/study tools.

IMPORTANT REQUIREMENTS:
1. Generate ONLY valid HTML content that can be embedded in an iframe
2. Include all necessary CSS styles inline within <style> tags
3. Include all necessary JavaScript within <script> tags
4. Make the content fully self-contained and interactive
5. Use modern, responsive design with good UX
6. Ensure accessibility with proper ARIA labels and semantic HTML
7. Use vibrant colors and engaging visual elements
8. Make sure all functionality works without external dependencies
9. Create modern and appealing UI
10. Make sure the app is COMPLETE. DO NOT ADD ANY "PLACEHOLDERS"
11. The result will be used for commercial use.
12. Do your best, we want quality.
13. Try your best to fill in stuff such as APIs.
14. There should be no placeholders.

The user wants: ${prompt}
${toolTypeInstruction}
${fileContext}

Generate complete HTML that will work immediately when loaded in an iframe.`;

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
