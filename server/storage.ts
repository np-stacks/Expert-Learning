import { users, generationRequests, customToolTypes, customCategories, type User, type InsertUser, type GenerationRequest, type InsertGenerationRequest, type CustomToolType, type CustomCategory } from "@shared/schema";
import { db } from "./db";
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

export class DatabaseStorage implements IStorage {
  // Assuming 'db' is accessible within the class, or passed as a constructor argument.
  // If 'db' is not directly accessible, you might need to refactor to pass it or make it a class member.
  // For the purpose of this edit, I'll assume 'db' is accessible as in the original code.
  private db = db;

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

export const storage = new DatabaseStorage();