# AI Educational Tool Generator

## Overview

This is a full-stack web application that generates interactive educational tools using AI. Users can input prompts describing what kind of educational content they want, and the system uses Google's Gemini AI to create complete HTML-based interactive tools like quizzes, flashcards, calculators, games, and more. The generated tools are fully self-contained and displayed in an iframe for immediate use.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React 18** with TypeScript for the user interface
- **Vite** as the build tool and development server
- **Tailwind CSS** for styling with a custom design system
- **shadcn/ui** component library for consistent UI components
- **Radix UI** primitives for accessible, unstyled components
- **Wouter** for lightweight client-side routing
- **TanStack Query** for server state management and API calls

### Backend Architecture
- **Express.js** server with TypeScript
- **RESTful API** design with a single `/api/generate` endpoint
- **In-memory storage** using a custom storage class for development
- **Rate limiting** implemented at the API level (30-second cooldown per IP)
- **Error handling** with standardized error responses
- **Request logging** middleware for API monitoring

### Data Storage
- **Drizzle ORM** configured for PostgreSQL with schema definitions
- **Database schema** includes users and generation_requests tables
- **In-memory fallback** storage for development environment
- **UUID-based primary keys** for all entities

### AI Integration
- **Google Gemini 2.5 Flash** model for content generation
- **Structured prompts** that ensure self-contained HTML output
- **Content validation** to ensure generated content is valid HTML
- **Error handling** for AI API failures with user-friendly messages

### Authentication & Security
- **Rate limiting** prevents abuse of the AI generation endpoint
- **Input validation** using Zod schemas for type safety
- **CORS configuration** for cross-origin requests
- **Environment variable** management for API keys

### Development Features
- **Hot module replacement** in development with Vite
- **TypeScript** throughout the entire stack
- **Path aliases** for clean imports (@/, @shared/, etc.)
- **Development banners** for Replit environment detection
- **Runtime error overlays** for debugging

## External Dependencies

- **Google Gemini AI**: Core AI service for generating educational content
- **Neon Database**: PostgreSQL serverless database (configured but not actively used)
- **Radix UI**: Comprehensive set of accessible component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **TanStack Query**: Data fetching and caching library
- **Drizzle ORM**: TypeScript ORM for database operations
- **Vite**: Build tool and development server
- **Express.js**: Web framework for the backend API