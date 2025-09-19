import { users, generationRequests, customToolTypes, customCategories, type User, type InsertUser, type GenerationRequest, type InsertGenerationRequest, type CustomToolType, type CustomCategory } from "@shared/schema";
import { eq, desc, asc, gte, lte, and, isNotNull } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createGenerationRequest(request: InsertGenerationRequest & { generatedHtml: string, userId?: string, category?: string, toolName?: string }): Promise<GenerationRequest>;
  getGenerationRequest(id: string): Promise<GenerationRequest | undefined>;
  getUserGenerationRequests(
    userId: string,
    filters?: {
      category?: string;
      toolType?: string;
      dateFrom?: string;
      dateTo?: string;
    },
    sortBy?: 'date' | 'type' | 'category',
    sortOrder?: 'asc' | 'desc'
  ): Promise<GenerationRequest[]>;
  getUserCategories(userId: string): Promise<string[]>;
  getPublicGenerationRequest(shareId: string): Promise<GenerationRequest | undefined>;
  updateGenerationRequest(id: string, updates: Partial<GenerationRequest>): Promise<GenerationRequest | undefined>;
  clearUserHistory(userId: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  createCustomToolType(data: { userId: string; name: string; description?: string }): Promise<CustomToolType>;
  getUserCustomToolTypes(userId: string): Promise<CustomToolType[]>;
  updateCustomToolType(id: string, userId: string, data: { name: string; description?: string }): Promise<CustomToolType | null>;
  deleteCustomToolType(id: string, userId: string): Promise<boolean>;
  createCustomCategory(data: { userId: string; name: string; }): Promise<CustomCategory>;
  getUserCustomCategories(userId: string): Promise<CustomCategory[]>;
  updateCustomCategory(id: string, userId: string, data: { name: string; }): Promise<CustomCategory | null>;
  deleteCustomCategory(id: string, userId: string): Promise<boolean>;
}

export class MemoryStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private usersByUsername: Map<string, User> = new Map();
  private generationRequests: Map<string, GenerationRequest> = new Map();
  private customToolTypes: Map<string, CustomToolType> = new Map();
  private customCategories: Map<string, CustomCategory> = new Map();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.usersByUsername.get(username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = {
      id: Math.random().toString(36).substr(2, 9),
      username: insertUser.username,
      password: insertUser.password,
    };
    this.users.set(user.id, user);
    this.usersByUsername.set(user.username, user);
    return user;
  }

  async createGenerationRequest(request: InsertGenerationRequest & { generatedHtml: string, userId?: string, category?: string, toolName?: string }): Promise<GenerationRequest> {
    const generationRequest: GenerationRequest = {
      id: Math.random().toString(36).substr(2, 9),
      userId: request.userId || null,
      prompt: request.prompt,
      toolType: request.toolType || null,
      category: request.category || "none",
      toolName: request.toolName || null,
      generatedHtml: request.generatedHtml,
      title: request.title || null,
      isPublic: false,
      shareId: null,
      createdAt: new Date(),
    };
    this.generationRequests.set(generationRequest.id, generationRequest);
    return generationRequest;
  }

  async getGenerationRequest(id: string): Promise<GenerationRequest | undefined> {
    return this.generationRequests.get(id);
  }

  async getUserGenerationRequests(userId: string, filters?: any, sortBy?: any, sortOrder?: any): Promise<GenerationRequest[]> {
    return Array.from(this.generationRequests.values()).filter(req => req.userId === userId);
  }

  async getUserCategories(userId: string): Promise<string[]> {
    const requests = await this.getUserGenerationRequests(userId);
    return [...new Set(requests.map(req => req.category).filter(Boolean))];
  }

  async getPublicGenerationRequest(shareId: string): Promise<GenerationRequest | undefined> {
    return Array.from(this.generationRequests.values()).find(req => req.shareId === shareId);
  }

  async updateGenerationRequest(id: string, updates: Partial<GenerationRequest>): Promise<GenerationRequest | undefined> {
    const existing = this.generationRequests.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.generationRequests.set(id, updated);
    return updated;
  }

  async clearUserHistory(userId: string): Promise<void> {
    for (const [id, req] of this.generationRequests.entries()) {
      if (req.userId === userId) {
        this.generationRequests.delete(id);
      }
    }
  }

  async deleteUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      this.users.delete(userId);
      this.usersByUsername.delete(user.username);
    }
  }

  async createCustomToolType(data: { userId: string; name: string; description?: string }): Promise<CustomToolType> {
    const toolType: CustomToolType = {
      id: Math.random().toString(36).substr(2, 9),
      userId: data.userId,
      name: data.name,
      description: data.description || null,
      createdAt: new Date(),
    };
    this.customToolTypes.set(toolType.id, toolType);
    return toolType;
  }

  async getUserCustomToolTypes(userId: string): Promise<CustomToolType[]> {
    return Array.from(this.customToolTypes.values()).filter(tool => tool.userId === userId);
  }

  async updateCustomToolType(id: string, userId: string, data: { name: string; description?: string }): Promise<CustomToolType | null> {
    const existing = this.customToolTypes.get(id);
    if (!existing || existing.userId !== userId) return null;
    const updated = { ...existing, ...data };
    this.customToolTypes.set(id, updated);
    return updated;
  }

  async deleteCustomToolType(id: string, userId: string): Promise<boolean> {
    const existing = this.customToolTypes.get(id);
    if (!existing || existing.userId !== userId) return false;
    this.customToolTypes.delete(id);
    return true;
  }

  async createCustomCategory(data: { userId: string; name: string; }): Promise<CustomCategory> {
    const category: CustomCategory = {
      id: Math.random().toString(36).substr(2, 9),
      userId: data.userId,
      name: data.name,
      description: null,
      createdAt: new Date(),
    };
    this.customCategories.set(category.id, category);
    return category;
  }

  async getUserCustomCategories(userId: string): Promise<CustomCategory[]> {
    return Array.from(this.customCategories.values()).filter(cat => cat.userId === userId);
  }

  async updateCustomCategory(id: string, userId: string, data: { name: string; }): Promise<CustomCategory | null> {
    const existing = this.customCategories.get(id);
    if (!existing || existing.userId !== userId) return null;
    const updated = { ...existing, ...data };
    this.customCategories.set(id, updated);
    return updated;
  }

  async deleteCustomCategory(id: string, userId: string): Promise<boolean> {
    const existing = this.customCategories.get(id);
    if (!existing || existing.userId !== userId) return false;
    this.customCategories.delete(id);
    return true;
  }
}

export class DatabaseStorage implements IStorage {
  private db: any;

  constructor() {
    // Only import db when actually needed
    const { db } = require("./db");
    this.db = db;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await this.db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createGenerationRequest(request: InsertGenerationRequest & { generatedHtml: string, userId?: string, category?: string, toolName?: string }): Promise<GenerationRequest> {
    const [generationRequest] = await this.db
      .insert(generationRequests)
      .values({
        prompt: request.prompt,
        toolType: request.toolType || null,
        category: request.category || "none",
        toolName: request.toolName || null,
        generatedHtml: request.generatedHtml,
        title: request.title || null,
        userId: request.userId || null,
      })
      .returning();
    return generationRequest;
  }

  async getGenerationRequest(id: string): Promise<GenerationRequest | undefined> {
    const [generationRequest] = await this.db.select().from(generationRequests).where(eq(generationRequests.id, id));
    return generationRequest || undefined;
  }

  async getUserGenerationRequests(
    userId: string,
    filters?: {
      category?: string;
      toolType?: string;
      dateFrom?: string;
      dateTo?: string;
    },
    sortBy?: 'date' | 'type' | 'category',
    sortOrder?: 'asc' | 'desc'
  ): Promise<GenerationRequest[]> {
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

    const orderColumn = sortBy === 'type' ? generationRequests.toolType :
                       sortBy === 'category' ? generationRequests.category :
                       generationRequests.createdAt;

    const orderDirection = sortOrder === 'asc' ? asc : desc;

    return await this.db
      .select()
      .from(generationRequests)
      .where(and(...conditions))
      .orderBy(orderDirection(orderColumn));
  }

  async getUserCategories(userId: string): Promise<string[]> {
    const results = await this.db
      .selectDistinct({ category: generationRequests.category })
      .from(generationRequests)
      .where(and(
        eq(generationRequests.userId, userId),
        isNotNull(generationRequests.category)
      ));

    return results
      .map(result => result.category)
      .filter((category): category is string => category !== null && category !== 'uncategorized')
      .sort();
  }

  async getPublicGenerationRequest(shareId: string): Promise<GenerationRequest | undefined> {
    const [generationRequest] = await this.db.select().from(generationRequests).where(eq(generationRequests.shareId, shareId));
    return generationRequest || undefined;
  }

  async updateGenerationRequest(id: string, updates: Partial<GenerationRequest>): Promise<GenerationRequest | undefined> {
    const [generationRequest] = await this.db
      .update(generationRequests)
      .set(updates)
      .where(eq(generationRequests.id, id))
      .returning();
    return generationRequest || undefined;
  }

  async deleteUser(userId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Delete all generation requests for the user
      await tx.delete(generationRequests).where(eq(generationRequests.userId, userId));

      // Delete all custom tool types for the user
      await tx.delete(customToolTypes).where(eq(customToolTypes.userId, userId));

      // Delete all custom categories for the user
      await tx.delete(customCategories).where(eq(customCategories.userId, userId));

      // Delete the user
      await tx.delete(users).where(eq(users.id, userId));
    });
  }

  async createCustomToolType(data: { userId: string; name: string; description?: string }): Promise<CustomToolType> {
    const [customToolType] = await this.db
      .insert(customToolTypes)
      .values({
        userId: data.userId,
        name: data.name,
        description: data.description,
      })
      .returning();

    return customToolType;
  }

  async getUserCustomToolTypes(userId: string): Promise<CustomToolType[]> {
    return this.db
      .select()
      .from(customToolTypes)
      .where(eq(customToolTypes.userId, userId))
      .orderBy(desc(customToolTypes.createdAt));
  }

  async updateCustomToolType(id: string, userId: string, data: { name: string; description?: string }): Promise<CustomToolType | null> {
    const [customToolType] = await this.db
      .update(customToolTypes)
      .set({
        name: data.name,
        description: data.description,
      })
      .where(and(eq(customToolTypes.id, id), eq(customToolTypes.userId, userId)))
      .returning();

    return customToolType || null;
  }

  async deleteCustomToolType(id: string, userId: string): Promise<boolean> {
    const [deleted] = await this.db
      .delete(customToolTypes)
      .where(and(eq(customToolTypes.id, id), eq(customToolTypes.userId, userId)))
      .returning();

    return !!deleted;
  }

  async deleteGenerationRequest(id: string, userId: string): Promise<boolean> {
    const [deleted] = await this.db
      .delete(generationRequests)
      .where(and(eq(generationRequests.id, id), eq(generationRequests.userId, userId)))
      .returning();

    return !!deleted;
  }

  async clearUserHistory(userId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Delete all generation requests
      await tx.delete(generationRequests).where(eq(generationRequests.userId, userId));

      // Delete all custom tool types
      await tx.delete(customToolTypes).where(eq(customToolTypes.userId, userId));

      // Delete all custom categories for the user
      await tx.delete(customCategories).where(eq(customCategories.userId, userId));
    });
  }

  async createCustomCategory(data: { userId: string; name: string; description?: string; }): Promise<CustomCategory> {
    const [customCategory] = await this.db
      .insert(customCategories)
      .values({
        userId: data.userId,
        name: data.name,
        description: data.description,
      })
      .returning();

    return customCategory;
  }

  async getUserCustomCategories(userId: string): Promise<CustomCategory[]> {
    return this.db
      .select()
      .from(customCategories)
      .where(eq(customCategories.userId, userId))
      .orderBy(desc(customCategories.createdAt));
  }

  async updateCustomCategory(id: string, userId: string, data: { name: string; description?: string; }): Promise<CustomCategory | null> {
    const [customCategory] = await this.db
      .update(customCategories)
      .set({
        name: data.name,
        description: data.description,
      })
      .where(and(eq(customCategories.id, id), eq(customCategories.userId, userId)))
      .returning();

    return customCategory || null;
  }

  async deleteCustomCategory(id: string, userId: string): Promise<boolean> {
    const [deleted] = await this.db
      .delete(customCategories)
      .where(and(eq(customCategories.id, id), eq(customCategories.userId, userId)))
      .returning();

    return !!deleted;
  }
}

// Use memory storage by default to avoid database connection issues
// Set USE_DATABASE=true environment variable to use database storage
export const storage = process.env.USE_DATABASE === 'true' 
  ? new DatabaseStorage() 
  : new MemoryStorage();
