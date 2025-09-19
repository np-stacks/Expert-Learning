
import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import express from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { registerRoutes } from "../../server/routes";
import { storage } from "../../server/storage";

// Initialize Express app
const app = express();

// Configure middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Session configuration for Netlify (using memory store)
const sessionStore = new (MemoryStore(session))({
  checkPeriod: 86400000
});

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'development-secret-change-in-production',
  name: 'sessionId',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  },
}));

// Google OAuth configuration
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.NODE_ENV === 'production' ? "/.netlify/functions/api/auth/google/callback" : "/api/auth/google/callback"
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
      return done(error, undefined);
    }
  }));

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  app.use(passport.initialize());
  app.use(passport.session());
}

// Register API routes
registerRoutes(app);

// Netlify function handler
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Set environment variable to indicate Netlify deployment
  process.env.NETLIFY_DEPLOYMENT = '1';
  
  return new Promise((resolve, reject) => {
    // Extract the API path from the Netlify function path
    const apiPath = event.path.replace(/^\/\.netlify\/functions\/api/, '') || '/';
    
    const req = {
      method: event.httpMethod,
      url: apiPath,
      headers: event.headers,
      body: event.body,
      query: event.queryStringParameters,
      ip: event.headers['x-forwarded-for'] || event.headers['client-ip'] || '127.0.0.1',
      connection: { remoteAddress: event.headers['x-forwarded-for'] || '127.0.0.1' },
      session: {},
    } as any;

    const res = {
      statusCode: 200,
      headers: {},
      body: '',
      status: function(code: number) {
        this.statusCode = code;
        return this;
      },
      json: function(data: any) {
        this.headers['Content-Type'] = 'application/json';
        this.body = JSON.stringify(data);
        resolve({
          statusCode: this.statusCode,
          headers: this.headers,
          body: this.body,
        });
        return this;
      },
      send: function(data: any) {
        this.body = data;
        resolve({
          statusCode: this.statusCode,
          headers: this.headers,
          body: this.body,
        });
        return this;
      },
      setHeader: function(name: string, value: string) {
        this.headers[name] = value;
        return this;
      },
      redirect: function(url: string) {
        this.statusCode = 302;
        this.headers['Location'] = url;
        resolve({
          statusCode: this.statusCode,
          headers: this.headers,
          body: '',
        });
        return this;
      },
      clearCookie: function(name: string, options: any) {
        this.headers['Set-Cookie'] = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        return this;
      },
      end: function(data?: any) {
        if (data) this.body = data;
        resolve({
          statusCode: this.statusCode,
          headers: this.headers,
          body: this.body,
        });
      }
    } as any;

    try {
      // Handle the request with Express app
      app(req, res, () => {
        // Default 404 handler
        res.status(404).json({ message: 'Not found' });
      });
    } catch (error) {
      console.error('Handler error:', error);
      resolve({
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Internal server error' }),
      });
    }
  });
};
