var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  createCustomCategorySchema: () => createCustomCategorySchema,
  createCustomToolTypeSchema: () => createCustomToolTypeSchema,
  customCategories: () => customCategories,
  customCategoriesRelations: () => customCategoriesRelations,
  customToolTypes: () => customToolTypes,
  customToolTypesRelations: () => customToolTypesRelations,
  generateToolSchema: () => generateToolSchema,
  generationRequests: () => generationRequests,
  generationRequestsRelations: () => generationRequestsRelations,
  insertGenerationRequestSchema: () => insertGenerationRequestSchema,
  insertUserSchema: () => insertUserSchema,
  loginSchema: () => loginSchema,
  registerSchema: () => registerSchema,
  updateCustomCategorySchema: () => updateCustomCategorySchema,
  updateCustomToolTypeSchema: () => updateCustomToolTypeSchema,
  users: () => users,
  usersRelations: () => usersRelations
});
import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users, customToolTypes, customCategories, generationRequests, usersRelations, customToolTypesRelations, customCategoriesRelations, generationRequestsRelations, insertUserSchema, insertGenerationRequestSchema, generateToolSchema, loginSchema, registerSchema, createCustomToolTypeSchema, updateCustomToolTypeSchema, createCustomCategorySchema, updateCustomCategorySchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    users = pgTable("users", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      username: text("username").notNull().unique(),
      password: text("password").notNull()
    });
    customToolTypes = pgTable("custom_tool_types", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().references(() => users.id),
      name: text("name").notNull(),
      description: text("description"),
      createdAt: timestamp("created_at").defaultNow()
    });
    customCategories = pgTable("custom_categories", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().references(() => users.id),
      name: text("name").notNull(),
      description: text("description"),
      createdAt: timestamp("created_at").defaultNow()
    });
    generationRequests = pgTable("generation_requests", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").references(() => users.id),
      prompt: text("prompt").notNull(),
      toolType: text("tool_type"),
      category: text("category").default("none"),
      toolName: text("tool_name"),
      generatedHtml: text("generated_html"),
      title: text("title"),
      isPublic: boolean("is_public").default(false),
      shareId: varchar("share_id").unique(),
      createdAt: timestamp("created_at").defaultNow()
    });
    usersRelations = relations(users, ({ many }) => ({
      generationRequests: many(generationRequests),
      customToolTypes: many(customToolTypes),
      customCategories: many(customCategories)
    }));
    customToolTypesRelations = relations(customToolTypes, ({ one }) => ({
      user: one(users, {
        fields: [customToolTypes.userId],
        references: [users.id]
      })
    }));
    customCategoriesRelations = relations(customCategories, ({ one }) => ({
      user: one(users, {
        fields: [customCategories.userId],
        references: [users.id]
      })
    }));
    generationRequestsRelations = relations(generationRequests, ({ one }) => ({
      user: one(users, {
        fields: [generationRequests.userId],
        references: [users.id]
      })
    }));
    insertUserSchema = createInsertSchema(users).pick({
      username: true,
      password: true
    });
    insertGenerationRequestSchema = createInsertSchema(generationRequests).pick({
      prompt: true,
      toolType: true,
      toolName: true,
      title: true
    });
    generateToolSchema = z.object({
      prompt: z.string().min(1).max(500),
      toolType: z.union([
        z.enum(["auto", "quiz", "flashcards", "chart", "worksheet", "timeline", "game", "lecture", "diagram", "custom"]),
        z.string().min(1).max(50)
        // Allow custom tool type names as strings
      ]).default("auto"),
      category: z.string().min(1).max(50).default("none"),
      toolName: z.string().max(100).optional()
    });
    loginSchema = z.object({
      username: z.string().min(1, "Username is required"),
      password: z.string().min(1, "Password is required")
    });
    registerSchema = z.object({
      username: z.string().min(3, "Username must be at least 3 characters").max(50, "Username must be less than 50 characters"),
      password: z.string().min(6, "Password must be at least 6 characters")
    });
    createCustomToolTypeSchema = z.object({
      name: z.string().min(1, "Tool type name is required").max(50, "Tool type name must be less than 50 characters"),
      description: z.string().max(200, "Description must be less than 200 characters").optional()
    });
    updateCustomToolTypeSchema = z.object({
      name: z.string().min(1, "Tool type name is required").max(50, "Tool type name must be less than 50 characters"),
      description: z.string().max(200, "Description must be less than 200 characters").optional()
    });
    createCustomCategorySchema = z.object({
      name: z.string().min(1, "Category name is required").max(50, "Category name must be less than 50 characters"),
      description: z.string().max(200, "Description must be less than 200 characters").optional()
    });
    updateCustomCategorySchema = z.object({
      name: z.string().min(1, "Category name is required").max(50, "Category name must be less than 50 characters"),
      description: z.string().max(200, "Description must be less than 200 characters").optional()
    });
  }
});

// server/index.ts
import express2 from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import MemoryStore from "memorystore";
import passport2 from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

// server/db.ts
init_schema();
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle({ client: pool, schema: schema_exports });

// server/routes.ts
import { createServer } from "http";
import passport from "passport";

// server/storage.ts
init_schema();
import { eq, desc, asc, gte, lte, and, isNotNull } from "drizzle-orm";
var DatabaseStorage = class {
  // Assuming 'db' is accessible within the class, or passed as a constructor argument.
  // If 'db' is not directly accessible, you might need to refactor to pass it or make it a class member.
  // For the purpose of this edit, I'll assume 'db' is accessible as in the original code.
  db = db;
  async getUser(id) {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user || void 0;
  }
  async getUserByUsername(username) {
    const [user] = await this.db.select().from(users).where(eq(users.username, username));
    return user || void 0;
  }
  async createUser(insertUser) {
    const [user] = await this.db.insert(users).values(insertUser).returning();
    return user;
  }
  async createGenerationRequest(request) {
    const [generationRequest] = await this.db.insert(generationRequests).values({
      prompt: request.prompt,
      toolType: request.toolType || null,
      category: request.category || "none",
      toolName: request.toolName || null,
      generatedHtml: request.generatedHtml,
      title: request.title || null,
      userId: request.userId || null
    }).returning();
    return generationRequest;
  }
  async getGenerationRequest(id) {
    const [generationRequest] = await this.db.select().from(generationRequests).where(eq(generationRequests.id, id));
    return generationRequest || void 0;
  }
  async getUserGenerationRequests(userId, filters, sortBy, sortOrder) {
    const conditions = [eq(generationRequests.userId, userId)];
    if (filters?.category) {
      conditions.push(eq(generationRequests.category, filters.category));
    }
    if (filters?.toolType) {
      conditions.push(eq(generationRequests.toolType, filters.toolType));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(generationRequests.createdAt, new Date(filters.dateFrom)));
    }
    if (filters?.dateTo) {
      conditions.push(lte(generationRequests.createdAt, new Date(filters.dateTo)));
    }
    const orderColumn = sortBy === "type" ? generationRequests.toolType : sortBy === "category" ? generationRequests.category : generationRequests.createdAt;
    const orderDirection = sortOrder === "asc" ? asc : desc;
    return await this.db.select().from(generationRequests).where(and(...conditions)).orderBy(orderDirection(orderColumn));
  }
  async getUserCategories(userId) {
    const results = await this.db.selectDistinct({ category: generationRequests.category }).from(generationRequests).where(and(
      eq(generationRequests.userId, userId),
      isNotNull(generationRequests.category)
    ));
    return results.map((result) => result.category).filter((category) => category !== null && category !== "uncategorized").sort();
  }
  async getPublicGenerationRequest(shareId) {
    const [generationRequest] = await this.db.select().from(generationRequests).where(eq(generationRequests.shareId, shareId));
    return generationRequest || void 0;
  }
  async updateGenerationRequest(id, updates) {
    const [generationRequest] = await this.db.update(generationRequests).set(updates).where(eq(generationRequests.id, id)).returning();
    return generationRequest || void 0;
  }
  async deleteUser(userId) {
    await this.db.transaction(async (tx) => {
      await tx.delete(generationRequests).where(eq(generationRequests.userId, userId));
      await tx.delete(customToolTypes).where(eq(customToolTypes.userId, userId));
      await tx.delete(customCategories).where(eq(customCategories.userId, userId));
      await tx.delete(users).where(eq(users.id, userId));
    });
  }
  async createCustomToolType(data) {
    const [customToolType] = await this.db.insert(customToolTypes).values({
      userId: data.userId,
      name: data.name,
      description: data.description
    }).returning();
    return customToolType;
  }
  async getUserCustomToolTypes(userId) {
    return this.db.select().from(customToolTypes).where(eq(customToolTypes.userId, userId)).orderBy(desc(customToolTypes.createdAt));
  }
  async updateCustomToolType(id, userId, data) {
    const [customToolType] = await this.db.update(customToolTypes).set({
      name: data.name,
      description: data.description
    }).where(and(eq(customToolTypes.id, id), eq(customToolTypes.userId, userId))).returning();
    return customToolType || null;
  }
  async deleteCustomToolType(id, userId) {
    const [deleted] = await this.db.delete(customToolTypes).where(and(eq(customToolTypes.id, id), eq(customToolTypes.userId, userId))).returning();
    return !!deleted;
  }
  async deleteGenerationRequest(id, userId) {
    const [deleted] = await this.db.delete(generationRequests).where(and(eq(generationRequests.id, id), eq(generationRequests.userId, userId))).returning();
    return !!deleted;
  }
  async clearUserHistory(userId) {
    await this.db.transaction(async (tx) => {
      await tx.delete(generationRequests).where(eq(generationRequests.userId, userId));
      await tx.delete(customToolTypes).where(eq(customToolTypes.userId, userId));
      await tx.delete(customCategories).where(eq(customCategories.userId, userId));
    });
  }
  async createCustomCategory(data) {
    const [customCategory] = await this.db.insert(customCategories).values({
      userId: data.userId,
      name: data.name,
      description: data.description
    }).returning();
    return customCategory;
  }
  async getUserCustomCategories(userId) {
    return this.db.select().from(customCategories).where(eq(customCategories.userId, userId)).orderBy(desc(customCategories.createdAt));
  }
  async updateCustomCategory(id, userId, data) {
    const [customCategory] = await this.db.update(customCategories).set({
      name: data.name,
      description: data.description
    }).where(and(eq(customCategories.id, id), eq(customCategories.userId, userId))).returning();
    return customCategory || null;
  }
  async deleteCustomCategory(id, userId) {
    const [deleted] = await this.db.delete(customCategories).where(and(eq(customCategories.id, id), eq(customCategories.userId, userId))).returning();
    return !!deleted;
  }
};
var storage = new DatabaseStorage();

// server/services/gemini.ts
import { GoogleGenAI } from "@google/genai";
var ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});
var genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});
async function enhancePrompt(originalPrompt) {
  const enhancePromptText = `
You are an educational tool prompt enhancer. Your job is to take a basic prompt and enhance it to create better, more detailed educational tools.

Take this prompt: "${originalPrompt}"

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
async function generateWithRetry(prompt, systemPrompt, maxRetries = 3, baseDelay = 1e3) {
  const models = ["gemini-2.5-flash", "gemini-2.5-flash-Lite", "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro", "gemini-1.5-flash"];
  for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
    const model = models[modelIndex];
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `Attempting generation with ${model}, attempt ${attempt + 1}`
        );
        const response = await ai.models.generateContent({
          model,
          config: {
            systemInstruction: systemPrompt
          },
          contents: prompt
        });
        const generatedContent = response.text;
        if (!generatedContent) {
          throw new Error("No content generated from AI");
        }
        console.log(
          `Successfully generated with ${model} on attempt ${attempt + 1}`
        );
        return generatedContent;
      } catch (error) {
        const isOverloadedError = error?.status === 503 || error?.message && error.message.includes("overloaded") || error?.message && error.message.includes("UNAVAILABLE");
        console.log(
          `Error with ${model} on attempt ${attempt + 1}:`,
          error?.message || error
        );
        if (isOverloadedError && (attempt < maxRetries || modelIndex < models.length - 1)) {
          if (attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt);
            console.log(
              `Model ${model} overloaded, waiting ${delay}ms before retry ${attempt + 2}`
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          } else {
            console.log(`Max retries reached for ${model}, trying next model`);
            break;
          }
        } else {
          if (modelIndex === models.length - 1 && attempt === maxRetries) {
            throw error;
          } else if (!isOverloadedError) {
            break;
          }
        }
      }
    }
  }
  throw new Error("All models failed after retries");
}
async function generateEducationalTool(prompt, toolType) {
  try {
    let toolTypeInstruction = "";
    if (toolType && toolType !== "auto") {
      const toolTypeMap = {
        quiz: "Create an interactive quiz with multiple choice questions, immediate feedback, and a score counter.",
        flashcards: "Create interactive digital flashcards that users can flip through with click/tap interactions.",
        chart: "Create an interactive chart or graph with detailed data visualization.",
        worksheet: "Create an interactive worksheet with fillable fields and exercises.",
        timeline: "Create an interactive timeline with detailed clickable events and detailed information.",
        game: "Create an educational game with interactive elements and scoring.",
        lecture: "Create a interactive slideshow relating to the subject. Allow the user to move between slides, and include detailed information in each slide.",
        diagram: "Create an interactive diagram or infographic with detailed and clickable elements.",
        custom: "Create a highly customized, advanced educational tool with unique interactive features tailored specifically to the user's request. Use creative and innovative approaches that go beyond standard tool types."
      };
      if (toolTypeMap[toolType]) {
        toolTypeInstruction = `Specifically create: ${toolTypeMap[toolType]}`;
      } else {
        toolTypeInstruction = `Specifically create: ${toolType}. Create a highly customized, advanced educational tool with unique interactive features tailored specifically to this tool type and the user's request. Use creative and innovative approaches.`;
      }
    } else {
      toolTypeInstruction = "Choose the most appropriate tool type for this request and create it.";
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

Generate complete HTML that will work immediately when loaded in an iframe.`;
    const generatedContent = await generateWithRetry(prompt, systemPrompt);
    let cleanedContent = generatedContent.replace(/^```html\n?/i, "").replace(/\n?```$/i, "");
    cleanedContent = cleanedContent.replace(/^```\n?/i, "").replace(/\n?```$/i, "");
    if (!cleanedContent.includes("<html") && !cleanedContent.includes("<div")) {
      throw new Error("Generated content does not appear to be valid HTML");
    }
    return { html: cleanedContent, toolDescription: "" };
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error(
      `Failed to generate educational tool: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
async function analyzeImage(base64Data, mimeType) {
  try {
    const contents = [
      {
        inlineData: {
          data: base64Data,
          mimeType
        }
      },
      `Analyze this image in detail and describe its key elements, context, subject matter, and any text visible in the image. Focus on educational content that could be used to create learning tools.`
    ];
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents
    });
    return response.text || "Unable to analyze image";
  } catch (error) {
    console.error("Image analysis error:", error);
    throw new Error(
      `Failed to analyze image: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
async function generateEducationalToolWithFiles(prompt, toolType, fileContents) {
  try {
    let toolTypeInstruction = "";
    if (toolType && toolType !== "auto") {
      const toolTypeMap = {
        quiz: "Create an interactive quiz with multiple choice questions, immediate feedback, and a score counter.",
        flashcards: "Create interactive digital flashcards that users can flip through with click/tap interactions.",
        chart: "Create an interactive chart or graph with detailed data visualization.",
        worksheet: "Create an interactive worksheet with fillable fields and exercises.",
        timeline: "Create an interactive timeline with detailed clickable events and detailed information.",
        game: "Create an educational game with interactive elements and scoring.",
        lecture: "Create a interactive slideshow relating to the subject. Allow the user to move between slides, and include detailed information in each slide.",
        diagram: "Create an interactive diagram or infographic with detailed and clickable elements.",
        custom: "Create a highly customized, advanced educational tool with unique interactive features tailored specifically to the user's request. Use creative and innovative approaches that go beyond standard tool types."
      };
      if (toolTypeMap[toolType]) {
        toolTypeInstruction = `Specifically create: ${toolTypeMap[toolType]}`;
      } else {
        toolTypeInstruction = `Specifically create: ${toolType}. Create a highly customized, advanced educational tool with unique interactive features tailored specifically to this tool type and the user's request. Use creative and innovative approaches.`;
      }
    } else {
      toolTypeInstruction = "Choose the most appropriate tool type for this request and create it.";
    }
    let fileContext = "";
    if (fileContents && fileContents.length > 0) {
      fileContext = "\n\nThe user has also provided the following files for context:\n";
      fileContents.forEach((file, index) => {
        fileContext += `
File ${index + 1} (${file.fileName}):
${file.content}
`;
      });
      fileContext += "\nUse this file content to create more relevant and personalized educational tools. Incorporate the information from these files into the educational tool you create.";
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
      systemPrompt
    );
    let cleanedContent = generatedContent.replace(/^```html\n?/i, "").replace(/\n?```$/i, "");
    cleanedContent = cleanedContent.replace(/^```\n?/i, "").replace(/\n?```$/i, "");
    if (!cleanedContent.includes("<html") && !cleanedContent.includes("<div")) {
      throw new Error("Generated content does not appear to be valid HTML");
    }
    return { html: cleanedContent, toolDescription: "" };
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error(
      `Failed to generate educational tool: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

// server/routes.ts
init_schema();
import { ZodError } from "zod";
import bcrypt from "bcrypt";

// server/types.ts
import "express-session";

// server/routes.ts
import multer from "multer";
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ message: "Authentication required. Please log in to use this feature." });
  }
}
var rateLimitStore = /* @__PURE__ */ new Map();
var authRateLimitStore = /* @__PURE__ */ new Map();
var RATE_LIMIT_DURATION = 30 * 1e3;
var AUTH_RATE_LIMIT_ATTEMPTS = 5;
var AUTH_RATE_LIMIT_WINDOW = 15 * 60 * 1e3;
function isRateLimited(ip) {
  const lastRequest = rateLimitStore.get(ip);
  if (!lastRequest) return false;
  const timeSinceLastRequest = Date.now() - lastRequest;
  return timeSinceLastRequest < RATE_LIMIT_DURATION;
}
function updateRateLimit(ip) {
  rateLimitStore.set(ip, Date.now());
}
function getRemainingCooldown(ip) {
  const lastRequest = rateLimitStore.get(ip);
  if (!lastRequest) return 0;
  const timeSinceLastRequest = Date.now() - lastRequest;
  const remaining = RATE_LIMIT_DURATION - timeSinceLastRequest;
  return Math.max(0, Math.ceil(remaining / 1e3));
}
function isAuthRateLimited(ip) {
  const record = authRateLimitStore.get(ip);
  if (!record) return false;
  const now = Date.now();
  const timeSinceLastAttempt = now - record.lastAttempt;
  if (timeSinceLastAttempt > AUTH_RATE_LIMIT_WINDOW) {
    authRateLimitStore.delete(ip);
    return false;
  }
  return record.attempts >= AUTH_RATE_LIMIT_ATTEMPTS;
}
function updateAuthRateLimit(ip, success) {
  const now = Date.now();
  const record = authRateLimitStore.get(ip);
  if (!record) {
    authRateLimitStore.set(ip, { attempts: success ? 0 : 1, lastAttempt: now });
    return;
  }
  const timeSinceLastAttempt = now - record.lastAttempt;
  if (timeSinceLastAttempt > AUTH_RATE_LIMIT_WINDOW) {
    authRateLimitStore.set(ip, { attempts: success ? 0 : 1, lastAttempt: now });
    return;
  }
  if (success) {
    authRateLimitStore.delete(ip);
  } else {
    record.attempts += 1;
    record.lastAttempt = now;
  }
}
function getAuthRemainingCooldown(ip) {
  const record = authRateLimitStore.get(ip);
  if (!record) return 0;
  const now = Date.now();
  const timeSinceLastAttempt = now - record.lastAttempt;
  const remaining = AUTH_RATE_LIMIT_WINDOW - timeSinceLastAttempt;
  return Math.max(0, Math.ceil(remaining / 1e3));
}
var upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
    // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "text/plain",
      "application/msword",
      // .doc
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      // .docx
      "application/vnd.ms-powerpoint",
      // .ppt
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      // .pptx
      "application/vnd.ms-excel",
      // .xls
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      // .xlsx
      "text/csv"
      // .csv
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("File type not supported. Please upload PDF, image, text, Word, PowerPoint, Excel, or CSV files."));
    }
  }
});
async function extractTextFromPDF(buffer) {
  try {
    const pdfParse = await import("pdf-parse");
    const data = await pdfParse.default(buffer);
    return data.text;
  } catch (error) {
    throw new Error("Failed to extract text from PDF");
  }
}
async function processTextFile(buffer) {
  return buffer.toString("utf-8");
}
async function analyzeImageWithGemini(buffer, mimeType) {
  try {
    const base64Data = buffer.toString("base64");
    const response = await analyzeImage(base64Data, mimeType);
    return response;
  } catch (error) {
    throw new Error("Failed to analyze image");
  }
}
async function registerRoutes(app2) {
  app2.post("/api/enhance-prompt", requireAuth, async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Prompt is required"
        });
      }
      if (prompt.trim().length > 500) {
        return res.status(400).json({
          success: false,
          message: "Prompt too long (max 500 characters)"
        });
      }
      const enhancedPrompt = await enhancePrompt(prompt.trim());
      res.json({
        success: true,
        enhancedPrompt
      });
    } catch (error) {
      console.error("Error enhancing prompt:", error);
      res.status(500).json({
        success: false,
        message: "Failed to enhance prompt"
      });
    }
  });
  app2.post("/api/generate", async (req, res) => {
    try {
      const clientIP = req.ip || req.connection.remoteAddress || "unknown";
      if (isRateLimited(clientIP)) {
        const remainingSeconds = getRemainingCooldown(clientIP);
        return res.status(429).json({
          message: `Please wait ${remainingSeconds} seconds before generating another tool`,
          remainingSeconds
        });
      }
      const validatedData = generateToolSchema.parse(req.body);
      const predefinedToolTypes = ["auto", "quiz", "flashcards", "chart", "worksheet", "timeline", "game", "lecture", "diagram", "custom"];
      if (!predefinedToolTypes.includes(validatedData.toolType) && !req.session.userId) {
        return res.status(401).json({
          message: "Custom tool types are only available for logged-in users. Please sign in to use this feature."
        });
      }
      const generatedResult = await generateEducationalTool(
        validatedData.prompt,
        validatedData.toolType
      );
      const generationRequest = await storage.createGenerationRequest({
        prompt: validatedData.prompt,
        toolType: validatedData.toolType,
        category: validatedData.category,
        toolName: validatedData.toolName,
        generatedHtml: generatedResult.html,
        userId: req.session.userId || void 0
      });
      updateRateLimit(clientIP);
      res.json({
        success: true,
        id: generationRequest.id,
        html: generatedResult.html,
        toolDescription: generatedResult.toolDescription || `Generated ${validatedData.toolType || "educational tool"} based on your prompt`
      });
    } catch (error) {
      console.error("Generation error:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: error.errors
        });
      }
      const errorMessage = error instanceof Error ? error.message : "Failed to generate educational tool";
      if (errorMessage.includes("overloaded") || errorMessage.includes("UNAVAILABLE") || errorMessage.includes("All models failed")) {
        return res.status(503).json({
          message: "AI models are currently experiencing high demand. We've automatically tried multiple models and fallbacks. Please try again in a few moments.",
          retryAfter: 30
        });
      }
      res.status(500).json({
        message: errorMessage
      });
    }
  });
  app2.post("/api/auth/register", async (req, res) => {
    try {
      const clientIP = req.ip || req.connection.remoteAddress || "unknown";
      if (isAuthRateLimited(clientIP)) {
        const remainingSeconds = getAuthRemainingCooldown(clientIP);
        return res.status(429).json({
          message: `Too many registration attempts. Please wait ${Math.ceil(remainingSeconds / 60)} minutes before trying again.`,
          remainingSeconds
        });
      }
      const validatedData = registerSchema.parse(req.body);
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        updateAuthRateLimit(clientIP, false);
        return res.status(409).json({
          message: "Username already exists"
        });
      }
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(validatedData.password, saltRounds);
      const user = await storage.createUser({
        username: validatedData.username,
        password: hashedPassword
      });
      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regeneration error:", err);
          return res.status(500).json({
            message: "Registration failed"
          });
        }
        req.session.userId = user.id;
        updateAuthRateLimit(clientIP, true);
        res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username
          }
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      const clientIP = req.ip || req.connection.remoteAddress || "unknown";
      updateAuthRateLimit(clientIP, false);
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Invalid registration data",
          errors: error.errors
        });
      }
      res.status(500).json({
        message: "Registration failed"
      });
    }
  });
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const clientIP = req.ip || req.connection.remoteAddress || "unknown";
      if (isAuthRateLimited(clientIP)) {
        const remainingSeconds = getAuthRemainingCooldown(clientIP);
        return res.status(429).json({
          message: `Too many login attempts. Please wait ${Math.ceil(remainingSeconds / 60)} minutes before trying again.`,
          remainingSeconds
        });
      }
      const validatedData = loginSchema.parse(req.body);
      const user = await storage.getUserByUsername(validatedData.username);
      if (!user) {
        updateAuthRateLimit(clientIP, false);
        return res.status(401).json({
          message: "Invalid username or password"
        });
      }
      const isPasswordValid = await bcrypt.compare(validatedData.password, user.password);
      if (!isPasswordValid) {
        updateAuthRateLimit(clientIP, false);
        return res.status(401).json({
          message: "Invalid username or password"
        });
      }
      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regeneration error:", err);
          return res.status(500).json({
            message: "Login failed"
          });
        }
        req.session.userId = user.id;
        updateAuthRateLimit(clientIP, true);
        res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username
          }
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      const clientIP = req.ip || req.connection.remoteAddress || "unknown";
      updateAuthRateLimit(clientIP, false);
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Invalid login data",
          errors: error.errors
        });
      }
      res.status(500).json({
        message: "Login failed"
      });
    }
  });
  app2.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({
          message: "Logout failed"
        });
      }
      res.clearCookie("sessionId", {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax"
      });
      res.json({
        success: true,
        message: "Logged out successfully"
      });
    });
  });
  app2.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({
          message: "Not authenticated"
        });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        req.session.destroy(() => {
        });
        return res.status(401).json({
          message: "User not found"
        });
      }
      res.json({
        user: {
          id: user.id,
          username: user.username
        }
      });
    } catch (error) {
      console.error("User info error:", error);
      res.status(500).json({
        message: "Failed to get user info"
      });
    }
  });
  app2.get("/api/cooldown", (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress || "unknown";
    const remainingSeconds = getRemainingCooldown(clientIP);
    res.json({
      remainingSeconds,
      canGenerate: remainingSeconds === 0
    });
  });
  app2.post("/api/generate-with-files", requireAuth, upload.array("files", 5), async (req, res) => {
    try {
      const clientIP = req.ip || req.connection.remoteAddress || "unknown";
      if (isRateLimited(clientIP)) {
        const remainingSeconds = getRemainingCooldown(clientIP);
        return res.status(429).json({
          message: `Please wait ${remainingSeconds} seconds before generating another tool`,
          remainingSeconds
        });
      }
      const { prompt, toolType, category, toolName } = req.body;
      if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        return res.status(400).json({
          message: "Prompt is required"
        });
      }
      if (prompt.trim().length > 500) {
        return res.status(400).json({
          message: "Prompt too long (max 500 characters)"
        });
      }
      const validToolTypes = ["auto", "quiz", "flashcards", "chart", "worksheet", "timeline", "game", "lecture", "diagram", "custom"];
      if (toolType && !validToolTypes.includes(toolType)) {
        if (!req.session.userId) {
          return res.status(400).json({
            message: "Custom tool types are only available for authenticated users"
          });
        }
        if (typeof toolType !== "string" || toolType.trim().length === 0 || toolType.trim().length > 50) {
          return res.status(400).json({
            message: "Invalid custom tool type name"
          });
        }
      }
      const files = req.files;
      let fileContents = [];
      if (files && files.length > 0) {
        for (const file of files) {
          try {
            let content = "";
            if (file.mimetype === "application/pdf") {
              content = await extractTextFromPDF(file.buffer);
              fileContents.push({
                type: "text",
                content,
                fileName: file.originalname
              });
            } else if (file.mimetype.startsWith("image/")) {
              content = await analyzeImageWithGemini(file.buffer, file.mimetype);
              fileContents.push({
                type: "image",
                content,
                fileName: file.originalname
              });
            } else if (file.mimetype === "text/plain" || file.mimetype === "text/csv") {
              content = await processTextFile(file.buffer);
              fileContents.push({
                type: "text",
                content,
                fileName: file.originalname
              });
            } else if (file.mimetype === "application/msword" || file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.mimetype === "application/vnd.ms-powerpoint" || file.mimetype === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || file.mimetype === "application/vnd.ms-excel" || file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
              content = `[${file.originalname}] - Office document detected. File size: ${(file.size / 1024 / 1024).toFixed(2)} MB. Content extraction for Office documents is not fully supported yet, but the file has been uploaded successfully.`;
              fileContents.push({
                type: "text",
                content,
                fileName: file.originalname
              });
            }
          } catch (fileError) {
            console.error(`Error processing file ${file.originalname}:`, fileError);
          }
        }
      }
      const generatedResult = await generateEducationalToolWithFiles(
        prompt.trim(),
        toolType,
        fileContents
      );
      const generationRequest = await storage.createGenerationRequest({
        prompt: prompt.trim(),
        toolType,
        category: category || "uncategorized",
        toolName,
        generatedHtml: generatedResult.html,
        userId: req.session.userId
      });
      updateRateLimit(clientIP);
      res.json({
        success: true,
        id: generationRequest.id,
        html: generatedResult.html,
        toolDescription: generatedResult.toolDescription || `Generated ${toolType || "educational tool"} based on your prompt and uploaded files`
      });
    } catch (error) {
      console.error("Generation with files error:", error);
      if (error instanceof Error && error.message.includes("File type not supported")) {
        return res.status(400).json({
          message: error.message
        });
      }
      const errorMessage = error instanceof Error ? error.message : "Failed to generate educational tool";
      if (errorMessage.includes("overloaded") || errorMessage.includes("UNAVAILABLE") || errorMessage.includes("All models failed")) {
        return res.status(503).json({
          message: "AI models are currently experiencing high demand. We've automatically tried multiple models and fallbacks. Please try again in a few moments.",
          retryAfter: 30
        });
      }
      res.status(500).json({
        message: errorMessage
      });
    }
  });
  app2.get("/api/history", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({
          message: "Not authenticated"
        });
      }
      const { category, toolType, dateFrom, dateTo, sortBy, sortOrder } = req.query;
      const filters = {
        category,
        toolType,
        dateFrom,
        dateTo
      };
      const history = await storage.getUserGenerationRequests(
        req.session.userId,
        filters,
        sortBy,
        sortOrder
      );
      const allUserData = await storage.getUserGenerationRequests(req.session.userId);
      const categories = Array.from(new Set(allUserData.map((item) => item.category))).filter(Boolean);
      const toolTypes = Array.from(new Set(allUserData.map((item) => item.toolType))).filter(Boolean);
      res.json({
        success: true,
        history,
        categories,
        toolTypes
      });
    } catch (error) {
      console.error("History retrieval error:", error);
      res.status(500).json({
        message: "Failed to retrieve history"
      });
    }
  });
  app2.delete("/api/history/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId;
      const deleted = await storage.deleteGenerationRequest(id, userId);
      if (!deleted) {
        return res.status(404).json({
          message: "History item not found"
        });
      }
      res.json({
        success: true,
        message: "History item deleted successfully"
      });
    } catch (error) {
      console.error("Delete history item error:", error);
      res.status(500).json({
        message: "Failed to delete history item"
      });
    }
  });
  app2.post("/api/clear-profile", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      await storage.clearUserHistory(userId);
      res.json({ success: true, message: "Profile cleared successfully" });
    } catch (error) {
      console.error("Clear profile error:", error);
      res.status(500).json({ message: "Failed to clear profile" });
    }
  });
  app2.delete("/api/delete-account", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      await storage.deleteUser(userId);
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destruction error:", err);
        }
      });
      res.json({ success: true, message: "Account deleted successfully" });
    } catch (error) {
      console.error("Delete account error:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });
  app2.get("/api/custom-tool-types", requireAuth, async (req, res) => {
    try {
      const customToolTypes2 = await storage.getUserCustomToolTypes(req.session.userId);
      res.json({
        success: true,
        customToolTypes: customToolTypes2
      });
    } catch (error) {
      console.error("Get custom tool types error:", error);
      res.status(500).json({
        message: "Failed to retrieve custom tool types"
      });
    }
  });
  app2.post("/api/custom-tool-types", requireAuth, async (req, res) => {
    try {
      const { createCustomToolTypeSchema: createCustomToolTypeSchema2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const validatedData = createCustomToolTypeSchema2.parse(req.body);
      const existingTypes = await storage.getUserCustomToolTypes(req.session.userId);
      const nameExists = existingTypes.some((type) => type.name.toLowerCase() === validatedData.name.toLowerCase());
      if (nameExists) {
        return res.status(409).json({
          message: "You already have a custom tool type with this name"
        });
      }
      const customToolType = await storage.createCustomToolType({
        userId: req.session.userId,
        name: validatedData.name,
        description: validatedData.description
      });
      res.json({
        success: true,
        customToolType
      });
    } catch (error) {
      console.error("Create custom tool type error:", error);
      if (error instanceof Error && error.name === "ZodError") {
        return res.status(400).json({
          message: "Invalid custom tool type data"
        });
      }
      res.status(500).json({
        message: "Failed to create custom tool type"
      });
    }
  });
  app2.put("/api/custom-tool-types/:id", requireAuth, async (req, res) => {
    try {
      const { updateCustomToolTypeSchema: updateCustomToolTypeSchema2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const validatedData = updateCustomToolTypeSchema2.parse(req.body);
      const { id } = req.params;
      const existingTypes = await storage.getUserCustomToolTypes(req.session.userId);
      const nameExists = existingTypes.some((type) => type.id !== id && type.name.toLowerCase() === validatedData.name.toLowerCase());
      if (nameExists) {
        return res.status(409).json({
          message: "You already have a custom tool type with this name"
        });
      }
      const customToolType = await storage.updateCustomToolType(id, req.session.userId, {
        name: validatedData.name,
        description: validatedData.description
      });
      if (!customToolType) {
        return res.status(404).json({
          message: "Custom tool type not found"
        });
      }
      res.json({
        success: true,
        customToolType
      });
    } catch (error) {
      console.error("Update custom tool type error:", error);
      if (error instanceof Error && error.name === "ZodError") {
        return res.status(400).json({
          message: "Invalid custom tool type data"
        });
      }
      res.status(500).json({
        message: "Failed to update custom tool type"
      });
    }
  });
  app2.delete("/api/custom-tool-types/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteCustomToolType(id, req.session.userId);
      if (!deleted) {
        return res.status(404).json({
          message: "Custom tool type not found"
        });
      }
      res.json({
        success: true,
        message: "Custom tool type deleted successfully"
      });
    } catch (error) {
      console.error("Delete custom tool type error:", error);
      res.status(500).json({
        message: "Failed to delete custom tool type"
      });
    }
  });
  app2.get("/api/custom-categories", requireAuth, async (req, res) => {
    try {
      const customCategories2 = await storage.getUserCustomCategories(req.session.userId);
      res.json({
        success: true,
        customCategories: customCategories2
      });
    } catch (error) {
      console.error("Get custom categories error:", error);
      res.status(500).json({
        message: "Failed to retrieve custom categories"
      });
    }
  });
  app2.post("/api/custom-categories", requireAuth, async (req, res) => {
    try {
      const { createCustomCategorySchema: createCustomCategorySchema2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const validatedData = createCustomCategorySchema2.parse(req.body);
      const existingCategories = await storage.getUserCustomCategories(req.session.userId);
      const nameExists = existingCategories.some((category) => category.name.toLowerCase() === validatedData.name.toLowerCase());
      if (nameExists) {
        return res.status(409).json({
          message: "You already have a custom category with this name"
        });
      }
      const customCategory = await storage.createCustomCategory({
        userId: req.session.userId,
        name: validatedData.name,
        description: validatedData.description
      });
      res.json({
        success: true,
        customCategory
      });
    } catch (error) {
      console.error("Create custom category error:", error);
      if (error instanceof Error && error.name === "ZodError") {
        return res.status(400).json({
          message: "Invalid custom category data"
        });
      }
      res.status(500).json({
        message: "Failed to create custom category"
      });
    }
  });
  app2.put("/api/custom-categories/:id", requireAuth, async (req, res) => {
    try {
      const { updateCustomCategorySchema: updateCustomCategorySchema2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const validatedData = updateCustomCategorySchema2.parse(req.body);
      const { id } = req.params;
      const existingCategories = await storage.getUserCustomCategories(req.session.userId);
      const nameExists = existingCategories.some((category) => category.id !== id && category.name.toLowerCase() === validatedData.name.toLowerCase());
      if (nameExists) {
        return res.status(409).json({
          message: "You already have a custom category with this name"
        });
      }
      const customCategory = await storage.updateCustomCategory(id, req.session.userId, {
        name: validatedData.name,
        description: validatedData.description
      });
      if (!customCategory) {
        return res.status(404).json({
          message: "Custom category not found"
        });
      }
      res.json({
        success: true,
        customCategory
      });
    } catch (error) {
      console.error("Update custom category error:", error);
      if (error instanceof Error && error.name === "ZodError") {
        return res.status(400).json({
          message: "Invalid custom category data"
        });
      }
      res.status(500).json({
        message: "Failed to update custom category"
      });
    }
  });
  app2.delete("/api/custom-categories/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteCustomCategory(id, req.session.userId);
      if (!deleted) {
        return res.status(404).json({
          message: "Custom category not found"
        });
      }
      res.json({
        success: true,
        message: "Custom category deleted successfully"
      });
    } catch (error) {
      console.error("Delete custom category error:", error);
      res.status(500).json({
        message: "Failed to delete custom category"
      });
    }
  });
  app2.get("/api/auth/google", passport.authenticate("google", {
    scope: ["profile"]
  }));
  app2.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/auth?error=google_auth_failed" }),
    (req, res) => {
      req.session.userId = req.user.id;
      res.redirect("/");
    }
  );
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  const clientPublicPath = path2.resolve(import.meta.dirname, "..", "client", "public");
  if (fs.existsSync(clientPublicPath)) {
    app2.use(express.static(clientPublicPath));
  }
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
if (!process.env.SESSION_SECRET) {
  console.error("\u274C SESSION_SECRET environment variable is required for production security");
  console.error("Please set SESSION_SECRET to a strong, random string (at least 32 characters)");
  process.exit(1);
}
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error("\u274C GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required for Google OAuth");
  process.exit(1);
}
var app = express2();
app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});
app.use(express2.json({ limit: "10mb" }));
app.use(express2.urlencoded({ extended: false, limit: "10mb" }));
var isDevelopment = process.env.NODE_ENV !== "production";
var sessionStore = isDevelopment ? new (MemoryStore(session))({
  checkPeriod: 864e5
  // prune expired entries every 24h
}) : new (connectPgSimple(session))({
  pool,
  tableName: "session",
  createTableIfMissing: true
});
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET,
  name: "sessionId",
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1e3,
    sameSite: "lax"
  }
}));
passport2.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/api/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const existingUser = await storage.getUserByUsername(profile.id);
    if (existingUser) {
      return done(null, existingUser);
    }
    const newUser = await storage.createUser({
      username: profile.id,
      password: "google-oauth"
    });
    return done(null, newUser);
  } catch (error) {
    return done(error, void 0);
  }
}));
passport2.serializeUser((user, done) => {
  done(null, user.id);
});
passport2.deserializeUser(async (id, done) => {
  try {
    const user = await storage.getUser(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});
app.use(passport2.initialize());
app.use(passport2.session());
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api") && path3 !== "/api/cooldown") {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
