import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { storage } from "./storage";
import { generateEducationalTool } from "./services/gemini";
import { generateToolSchema, loginSchema, registerSchema } from "@shared/schema";
import { ZodError } from "zod";
// bcrypt removed for Netlify compatibility - using crypto-based hashing in storage
import "./types";
import * as geminiService from "./services/gemini";
import express from 'express';
import multer from 'multer';
import fs from 'fs';

// Assuming activeStorage is defined and imported elsewhere,
// or this import is missing and needs to be added.
// For the purpose of this edit, we will assume it's available.
// If 'activeStorage' is not defined, this code will not run as is.
// Example placeholder if needed:
// import { activeStorage } from "./activeStorage"; // Uncomment and adjust if needed

function requireAuth(req: any, res: any, next: any) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ message: "Authentication required. Please log in to use this feature." });
  }
}

// Rate limiting
const rateLimitStore = new Map<string, number>();
const authRateLimitStore = new Map<string, { attempts: number; lastAttempt: number }>();
const RATE_LIMIT_DURATION = 30 * 1000;
const AUTH_RATE_LIMIT_ATTEMPTS = 5;
const AUTH_RATE_LIMIT_WINDOW = 15 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const lastRequest = rateLimitStore.get(ip);
  if (!lastRequest) return false;

  const timeSinceLastRequest = Date.now() - lastRequest;
  return timeSinceLastRequest < RATE_LIMIT_DURATION;
}

function updateRateLimit(ip: string): void {
  rateLimitStore.set(ip, Date.now());
}

function getRemainingCooldown(ip: string): number {
  const lastRequest = rateLimitStore.get(ip);
  if (!lastRequest) return 0;

  const timeSinceLastRequest = Date.now() - lastRequest;
  const remaining = RATE_LIMIT_DURATION - timeSinceLastRequest;
  return Math.max(0, Math.ceil(remaining / 1000));
}

function isAuthRateLimited(ip: string): boolean {
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

function updateAuthRateLimit(ip: string, success: boolean): void {
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

function getAuthRemainingCooldown(ip: string): number {
  const record = authRateLimitStore.get(ip);
  if (!record) return 0;

  const now = Date.now();
  const timeSinceLastAttempt = now - record.lastAttempt;
  const remaining = AUTH_RATE_LIMIT_WINDOW - timeSinceLastAttempt;
  return Math.max(0, Math.ceil(remaining / 1000));
}

// File upload configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'text/plain',
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.ms-powerpoint', // .ppt
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'text/csv' // .csv
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported. Please upload PDF, image, text, Word, PowerPoint, Excel, or CSV files.'));
    }
  }
});

// File processing functions
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = await import('pdf-parse');
    const data = await pdfParse.default(buffer);
    return data.text;
  } catch (error) {
    throw new Error('Failed to extract text from PDF');
  }
}

async function processTextFile(buffer: Buffer): Promise<string> {
  return buffer.toString('utf-8');
}

async function analyzeImageWithGemini(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    const base64Data = buffer.toString('base64');
    const response = await geminiService.analyzeImage(base64Data, mimeType);
    return response;
  } catch (error) {
    throw new Error('Failed to analyze image');
  }
}

export async function registerRoutes(app: Express, activeStorage = storage): Promise<Server> {

  // Enhance prompt (authenticated users only)
  app.post("/api/enhance-prompt", requireAuth, async (req: any, res: any) => {
    try {
      const { prompt } = req.body;

      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
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

      const enhancedPrompt = await geminiService.enhancePrompt(prompt.trim());

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


  app.post("/api/generate", async (req, res) => {
    try {
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

      if (isRateLimited(clientIP)) {
        const remainingSeconds = getRemainingCooldown(clientIP);
        return res.status(429).json({
          message: `Please wait ${remainingSeconds} seconds before generating another tool`,
          remainingSeconds
        });
      }

      const validatedData = generateToolSchema.parse(req.body);

      // Check if using custom tool types without authentication
      const predefinedToolTypes = ["auto", "quiz", "flashcards", "chart", "worksheet", "timeline", "game", "lecture", "diagram", "custom"];
      if (!predefinedToolTypes.includes(validatedData.toolType) && !req.session.userId) {
        return res.status(401).json({
          message: "Custom tool types are only available for logged-in users. Please sign in to use this feature.",
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
        userId: req.session.userId || undefined,
      });

      updateRateLimit(clientIP);

      res.json({
        success: true,
        id: generationRequest.id,
        html: generatedResult.html,
        toolDescription: generatedResult.toolDescription || `Generated ${validatedData.toolType || 'educational tool'} based on your prompt`,
      });

    } catch (error) {
      console.error("Generation error:", error);

      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: error.errors,
        });
      }

      // Check if it's a model overload error
      const errorMessage = error instanceof Error ? error.message : "Failed to generate educational tool";
      if (errorMessage.includes('overloaded') || errorMessage.includes('UNAVAILABLE') || errorMessage.includes('All models failed')) {
        return res.status(503).json({
          message: "AI models are currently experiencing high demand. We've automatically tried multiple models and fallbacks. Please try again in a few moments.",
          retryAfter: 30,
        });
      }

      res.status(500).json({
        message: errorMessage,
      });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

      if (isAuthRateLimited(clientIP)) {
        const remainingSeconds = getAuthRemainingCooldown(clientIP);
        return res.status(429).json({
          message: `Too many registration attempts. Please wait ${Math.ceil(remainingSeconds / 60)} minutes before trying again.`,
          remainingSeconds
        });
      }
      const validatedData = registerSchema.parse(req.body);

      const existingUser = await activeStorage.getUserByUsername(validatedData.username);
      if (existingUser) {
        updateAuthRateLimit(clientIP, false);
        return res.status(409).json({
          message: "Username already exists",
        });
      }

      const user = await activeStorage.createUser({
        username: validatedData.username,
        password: validatedData.password,
      });

      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regeneration error:", err);
          return res.status(500).json({
            message: "Registration failed",
          });
        }

        req.session.userId = user.id;

        updateAuthRateLimit(clientIP, true);

        res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
          },
        });
      });

    } catch (error) {
      console.error("Registration error:", error);
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      updateAuthRateLimit(clientIP, false);

      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Invalid registration data",
          errors: error.errors,
        });
      }

      res.status(500).json({
        message: "Registration failed",
      });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

      if (isAuthRateLimited(clientIP)) {
        const remainingSeconds = getAuthRemainingCooldown(clientIP);
        return res.status(429).json({
          message: `Too many login attempts. Please wait ${Math.ceil(remainingSeconds / 60)} minutes before trying again.`,
          remainingSeconds
        });
      }

      const validatedData = loginSchema.parse(req.body);

      // Use storage's built-in password verification
      const user = await activeStorage.verifyUserPassword(validatedData.username, validatedData.password);
      if (!user) {
        updateAuthRateLimit(clientIP, false);
        return res.status(401).json({
          message: "Invalid username or password",
        });
      }

      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regeneration error:", err);
          return res.status(500).json({
            message: "Login failed",
          });
        }

        req.session.userId = user.id;

        updateAuthRateLimit(clientIP, true);

        res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
          },
        });
      });

    } catch (error) {
      console.error("Login error:", error);
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      updateAuthRateLimit(clientIP, false);

      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Invalid login data",
          errors: error.errors,
        });
      }

      res.status(500).json({
        message: "Login failed",
      });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err: any) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({
          message: "Logout failed",
        });
      }

      res.clearCookie('sessionId', {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({
          message: "Not authenticated",
        });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({
          message: "User not found",
        });
      }

      res.json({
        user: {
          id: user.id,
          username: user.username,
        },
      });

    } catch (error) {
      console.error("User info error:", error);
      res.status(500).json({
        message: "Failed to get user info",
      });
    }
  });


  app.get("/api/cooldown", (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    const remainingSeconds = getRemainingCooldown(clientIP);

    res.json({
      remainingSeconds,
      canGenerate: remainingSeconds === 0,
    });
  });

  app.post("/api/generate-with-files", requireAuth, upload.array('files', 5), async (req: any, res: any) => {
    try {
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

      if (isRateLimited(clientIP)) {
        const remainingSeconds = getRemainingCooldown(clientIP);
        return res.status(429).json({
          message: `Please wait ${remainingSeconds} seconds before generating another tool`,
          remainingSeconds
        });
      }

      const { prompt, toolType, category, toolName } = req.body;

      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        return res.status(400).json({
          message: "Prompt is required"
        });
      }

      if (prompt.trim().length > 500) {
        return res.status(400).json({
          message: "Prompt too long (max 500 characters)"
        });
      }

      // Validate toolType - allow predefined types or custom strings for authenticated users
      const validToolTypes = ["auto", "quiz", "flashcards", "chart", "worksheet", "timeline", "game", "lecture", "diagram", "custom"];
      if (toolType && !validToolTypes.includes(toolType)) {
        // Check if it's a custom tool type name (only allowed for authenticated users)
        if (!req.session.userId) {
          return res.status(400).json({
            message: "Custom tool types are only available for authenticated users"
          });
        }
        // For authenticated users, allow custom tool type names as strings
        if (typeof toolType !== 'string' || toolType.trim().length === 0 || toolType.trim().length > 50) {
          return res.status(400).json({
            message: "Invalid custom tool type name"
          });
        }
      }

      const files = req.files as Express.Multer.File[];
      let fileContents: Array<{type: 'text' | 'image', content: string, fileName: string}> = [];

      if (files && files.length > 0) {
        for (const file of files) {
          try {
            let content = '';

            if (file.mimetype === 'application/pdf') {
              content = await extractTextFromPDF(file.buffer);
              fileContents.push({
                type: 'text',
                content: content,
                fileName: file.originalname
              });
            } else if (file.mimetype.startsWith('image/')) {
              content = await analyzeImageWithGemini(file.buffer, file.mimetype);
              fileContents.push({
                type: 'image',
                content: content,
                fileName: file.originalname
              });
            } else if (file.mimetype === 'text/plain' || file.mimetype === 'text/csv') {
              content = await processTextFile(file.buffer);
              fileContents.push({
                type: 'text',
                content: content,
                fileName: file.originalname
              });
            } else if (file.mimetype === 'application/msword' ||
                       file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                       file.mimetype === 'application/vnd.ms-powerpoint' ||
                       file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
                       file.mimetype === 'application/vnd.ms-excel' ||
                       file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
              // For Office documents, we'll treat them as binary files and provide basic info
              content = `[${file.originalname}] - Office document detected. File size: ${(file.size / 1024 / 1024).toFixed(2)} MB. Content extraction for Office documents is not fully supported yet, but the file has been uploaded successfully.`;
              fileContents.push({
                type: 'text',
                content: content,
                fileName: file.originalname
              });
            }
          } catch (fileError) {
            console.error(`Error processing file ${file.originalname}:`, fileError);
          }
        }
      }

      const generatedResult = await geminiService.generateEducationalToolWithFiles(
        prompt.trim(),
        toolType,
        fileContents
      );

      const generationRequest = await storage.createGenerationRequest({
        prompt: prompt.trim(),
        toolType: toolType,
        category: category || 'uncategorized',
        toolName: toolName,
        generatedHtml: generatedResult.html,
        userId: req.session.userId,
      });

      updateRateLimit(clientIP);

      res.json({
        success: true,
        id: generationRequest.id,
        html: generatedResult.html,
        toolDescription: generatedResult.toolDescription || `Generated ${toolType || 'educational tool'} based on your prompt and uploaded files`,
      });

    } catch (error) {
      console.error("Generation with files error:", error);

      if (error instanceof Error && error.message.includes('File type not supported')) {
        return res.status(400).json({
          message: error.message,
        });
      }

      // Check if it's a model overload error
      const errorMessage = error instanceof Error ? error.message : "Failed to generate educational tool";
      if (errorMessage.includes('overloaded') || errorMessage.includes('UNAVAILABLE') || errorMessage.includes('All models failed')) {
        return res.status(503).json({
          message: "AI models are currently experiencing high demand. We've automatically tried multiple models and fallbacks. Please try again in a few moments.",
          retryAfter: 30,
        });
      }

      res.status(500).json({
        message: errorMessage,
      });
    }
  });

  app.get("/api/history", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({
          message: "Not authenticated",
        });
      }

      const { category, toolType, dateFrom, dateTo, sortBy, sortOrder } = req.query;

      const filters = {
        category: category as string | undefined,
        toolType: toolType as string | undefined,
        dateFrom: dateFrom as string | undefined,
        dateTo: dateTo as string | undefined,
      };

      // Get filtered history for display
      const history = await storage.getUserGenerationRequests(
        req.session.userId,
        filters,
        sortBy as 'date' | 'type' | 'category' | undefined,
        sortOrder as 'asc' | 'desc' | undefined
      );

      // Get ALL user data for filter metadata (not filtered) to prevent filter options from disappearing
      const allUserData = await storage.getUserGenerationRequests(req.session.userId);
      const categories = Array.from(new Set(allUserData.map(item => item.category))).filter(Boolean);
      const toolTypes = Array.from(new Set(allUserData.map(item => item.toolType))).filter(Boolean);

      res.json({
        success: true,
        history,
        categories,
        toolTypes,
      });

    } catch (error) {
      console.error("History retrieval error:", error);
      res.status(500).json({
        message: "Failed to retrieve history",
      });
    }
  });

  // Delete single history item endpoint
  app.delete("/api/history/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId;

      const deleted = await storage.deleteGenerationRequest(id, userId);

      if (!deleted) {
        return res.status(404).json({
          message: "History item not found",
        });
      }

      res.json({
        success: true,
        message: "History item deleted successfully",
      });
    } catch (error) {
      console.error("Delete history item error:", error);
      res.status(500).json({
        message: "Failed to delete history item",
      });
    }
  });

  // Clear profile endpoint
  app.post("/api/clear-profile", requireAuth, async (req: any, res: any) => {
    try {
      const userId = req.session.userId;

      await storage.clearUserHistory(userId);

      res.json({ success: true, message: 'Profile cleared successfully' });
    } catch (error) {
      console.error('Clear profile error:', error);
      res.status(500).json({ message: 'Failed to clear profile' });
    }
  });

  // Delete account endpoint
  app.delete("/api/delete-account", requireAuth, async (req: any, res: any) => {
    try {
      const userId = req.session.userId;

      // Delete user and all associated data atomically
      await storage.deleteUser(userId);

      req.session.destroy((err: any) => {
        if (err) {
          console.error('Session destruction error:', err);
        }
      });

      res.json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({ message: 'Failed to delete account' });
    }
  });

  // Custom tool types routes
  app.get("/api/custom-tool-types", requireAuth, async (req: any, res: any) => {
    try {
      const customToolTypes = await storage.getUserCustomToolTypes(req.session.userId);
      res.json({
        success: true,
        customToolTypes,
      });
    } catch (error) {
      console.error("Get custom tool types error:", error);
      res.status(500).json({
        message: "Failed to retrieve custom tool types",
      });
    }
  });

  app.post("/api/custom-tool-types", requireAuth, async (req: any, res: any) => {
    try {
      const { createCustomToolTypeSchema } = await import("@shared/schema");
      const validatedData = createCustomToolTypeSchema.parse(req.body);

      // Check if user already has a custom tool type with this name
      const existingTypes = await storage.getUserCustomToolTypes(req.session.userId);
      const nameExists = existingTypes.some(type => type.name.toLowerCase() === validatedData.name.toLowerCase());

      if (nameExists) {
        return res.status(409).json({
          message: "You already have a custom tool type with this name",
        });
      }

      const customToolType = await storage.createCustomToolType({
        userId: req.session.userId,
        name: validatedData.name,
        description: validatedData.description,
      });

      res.json({
        success: true,
        customToolType,
      });
    } catch (error) {
      console.error("Create custom tool type error:", error);

      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({
          message: "Invalid custom tool type data",
        });
      }

      res.status(500).json({
        message: "Failed to create custom tool type",
      });
    }
  });

  app.put("/api/custom-tool-types/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { updateCustomToolTypeSchema } = await import("@shared/schema");
      const validatedData = updateCustomToolTypeSchema.parse(req.body);
      const { id } = req.params;

      // Check if user already has another custom tool type with this name
      const existingTypes = await storage.getUserCustomToolTypes(req.session.userId);
      const nameExists = existingTypes.some(type => type.id !== id && type.name.toLowerCase() === validatedData.name.toLowerCase());

      if (nameExists) {
        return res.status(409).json({
          message: "You already have a custom tool type with this name",
        });
      }

      const customToolType = await storage.updateCustomToolType(id, req.session.userId, {
        name: validatedData.name,
        description: validatedData.description,
      });

      if (!customToolType) {
        return res.status(404).json({
          message: "Custom tool type not found",
        });
      }

      res.json({
        success: true,
        customToolType,
      });
    } catch (error) {
      console.error("Update custom tool type error:", error);

      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({
          message: "Invalid custom tool type data",
        });
      }

      res.status(500).json({
        message: "Failed to update custom tool type",
      });
    }
  });

  app.delete("/api/custom-tool-types/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const deleted = await storage.deleteCustomToolType(id, req.session.userId);

      if (!deleted) {
        return res.status(404).json({
          message: "Custom tool type not found",
        });
      }

      res.json({
        success: true,
        message: "Custom tool type deleted successfully",
      });
    } catch (error) {
      console.error("Delete custom tool type error:", error);
      res.status(500).json({
        message: "Failed to delete custom tool type",
      });
    }
  });

  // Custom categories routes
  app.get("/api/custom-categories", requireAuth, async (req: any, res: any) => {
    try {
      const customCategories = await storage.getUserCustomCategories(req.session.userId);
      res.json({
        success: true,
        customCategories,
      });
    } catch (error) {
      console.error("Get custom categories error:", error);
      res.status(500).json({
        message: "Failed to retrieve custom categories",
      });
    }
  });

  app.post("/api/custom-categories", requireAuth, async (req: any, res: any) => {
    try {
      const { createCustomCategorySchema } = await import("@shared/schema");
      const validatedData = createCustomCategorySchema.parse(req.body);

      // Check if user already has a custom category with this name
      const existingCategories = await storage.getUserCustomCategories(req.session.userId);
      const nameExists = existingCategories.some(category => category.name.toLowerCase() === validatedData.name.toLowerCase());

      if (nameExists) {
        return res.status(409).json({
          message: "You already have a custom category with this name",
        });
      }

      const customCategory = await storage.createCustomCategory({
        userId: req.session.userId,
        name: validatedData.name,
        description: validatedData.description,
      });

      res.json({
        success: true,
        customCategory,
      });
    } catch (error) {
      console.error("Create custom category error:", error);

      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({
          message: "Invalid custom category data",
        });
      }

      res.status(500).json({
        message: "Failed to create custom category",
      });
    }
  });

  app.put("/api/custom-categories/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { updateCustomCategorySchema } = await import("@shared/schema");
      const validatedData = updateCustomCategorySchema.parse(req.body);
      const { id } = req.params;

      // Check if user already has another custom category with this name
      const existingCategories = await storage.getUserCustomCategories(req.session.userId);
      const nameExists = existingCategories.some(category => category.id !== id && category.name.toLowerCase() === validatedData.name.toLowerCase());

      if (nameExists) {
        return res.status(409).json({
          message: "You already have a custom category with this name",
        });
      }

      const customCategory = await storage.updateCustomCategory(id, req.session.userId, {
        name: validatedData.name,
        description: validatedData.description,
      });

      if (!customCategory) {
        return res.status(404).json({
          message: "Custom category not found",
        });
      }

      res.json({
        success: true,
        customCategory,
      });
    } catch (error) {
      console.error("Update custom category error:", error);

      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({
          message: "Invalid custom category data",
        });
      }

      res.status(500).json({
        message: "Failed to update custom category",
      });
    }
  });

  app.delete("/api/custom-categories/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const deleted = await storage.deleteCustomCategory(id, req.session.userId);

      if (!deleted) {
        return res.status(404).json({
          message: "Custom category not found",
        });
      }

      res.json({
        success: true,
        message: "Custom category deleted successfully",
      });
    } catch (error) {
      console.error("Delete custom category error:", error);
      res.status(500).json({
        message: "Failed to delete custom category",
      });
    }
  });

  // Google OAuth routes
  app.get("/api/auth/google", passport.authenticate("google", {
    scope: ["profile"]
  }));

  app.get("/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/auth?error=google_auth_failed" }),
    (req, res) => {
      req.session.userId = (req.user as any).id;
      res.redirect("/");
    }
  );

  const httpServer = createServer(app);
  return httpServer;
}
