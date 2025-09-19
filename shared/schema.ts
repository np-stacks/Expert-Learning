import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const customToolTypes = pgTable("custom_tool_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const customCategories = pgTable("custom_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const generationRequests = pgTable("generation_requests", {
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
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  generationRequests: many(generationRequests),
  customToolTypes: many(customToolTypes),
  customCategories: many(customCategories),
}));

export const customToolTypesRelations = relations(customToolTypes, ({ one }) => ({
  user: one(users, {
    fields: [customToolTypes.userId],
    references: [users.id],
  }),
}));

export const customCategoriesRelations = relations(customCategories, ({ one }) => ({
  user: one(users, {
    fields: [customCategories.userId],
    references: [users.id],
  }),
}));

export const generationRequestsRelations = relations(generationRequests, ({ one }) => ({
  user: one(users, {
    fields: [generationRequests.userId],
    references: [users.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertGenerationRequestSchema = createInsertSchema(generationRequests).pick({
  prompt: true,
  toolType: true,
  toolName: true,
  title: true,
});

export const generateToolSchema = z.object({
  prompt: z.string().min(1).max(500),
  toolType: z.union([
    z.enum(["auto", "quiz", "flashcards", "chart", "worksheet", "timeline", "game", "lecture", "diagram", "custom"]),
    z.string().min(1).max(50) // Allow custom tool type names as strings
  ]).default("auto"),
  category: z.string().min(1).max(50).default("none"),
  toolName: z.string().max(100).optional(),
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50, "Username must be less than 50 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const createCustomToolTypeSchema = z.object({
  name: z.string().min(1, "Tool type name is required").max(50, "Tool type name must be less than 50 characters"),
  description: z.string().max(200, "Description must be less than 200 characters").optional(),
});

export const updateCustomToolTypeSchema = z.object({
  name: z.string().min(1, "Tool type name is required").max(50, "Tool type name must be less than 50 characters"),
  description: z.string().max(200, "Description must be less than 200 characters").optional(),
});

export const createCustomCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(50, "Category name must be less than 50 characters"),
  description: z.string().max(200, "Description must be less than 200 characters").optional(),
});

export const updateCustomCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(50, "Category name must be less than 50 characters"),
  description: z.string().max(200, "Description must be less than 200 characters").optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type CustomToolType = typeof customToolTypes.$inferSelect;
export type CustomCategory = typeof customCategories.$inferSelect;
export type GenerationRequest = typeof generationRequests.$inferSelect;
export type InsertGenerationRequest = z.infer<typeof insertGenerationRequestSchema>;
export type GenerateToolRequest = z.infer<typeof generateToolSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type RegisterRequest = z.infer<typeof registerSchema>;
export type CreateCustomToolTypeRequest = z.infer<typeof createCustomToolTypeSchema>;
export type UpdateCustomToolTypeRequest = z.infer<typeof updateCustomToolTypeSchema>;
export type CreateCustomCategoryRequest = z.infer<typeof createCustomCategorySchema>;
export type UpdateCustomCategoryRequest = z.infer<typeof updateCustomCategorySchema>;