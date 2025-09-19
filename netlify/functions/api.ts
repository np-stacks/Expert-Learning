
import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import express from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { registerRoutes } from "../../server/routes";
import { storage } from "../../server/storage";

// Create a singleton Express app to maintain session state
let app: express.Application | null = null;
let sessionStore: any = null;

// Initialize the Express app only once
function getApp() {
  if (app) return app;

  app = express();
  
  // Configure middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false, limit: '10mb' }));

  // Session configuration for Netlify (using memory store)
  sessionStore = new (MemoryStore(session))({
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
      callbackURL: process.env.NODE_ENV === 'production' 
        ? `${process.env.URL}/.netlify/functions/api/auth/google/callback`
        : "/api/auth/google/callback"
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
  
  return app;
}

// Netlify function handler
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Set environment variable to indicate Netlify deployment
  process.env.NETLIFY_DEPLOYMENT = '1';
  
  const app = getApp();
  
  return new Promise((resolve, reject) => {
    // Extract the API path from the Netlify function path
    let apiPath = event.path.replace(/^\/\.netlify\/functions\/api/, '') || '/';
    
    // Handle query parameters
    const queryString = event.queryStringParameters 
      ? '?' + new URLSearchParams(event.queryStringParameters).toString()
      : '';
    
    if (queryString) {
      apiPath += queryString;
    }

    // Create a more complete request mock
    const req = {
      method: event.httpMethod,
      url: apiPath,
      path: apiPath.split('?')[0],
      query: event.queryStringParameters || {},
      headers: event.headers || {},
      body: event.body,
      rawBody: event.body,
      ip: event.headers['x-forwarded-for'] || event.headers['client-ip'] || '127.0.0.1',
      connection: { 
        remoteAddress: event.headers['x-forwarded-for'] || '127.0.0.1' 
      },
      get: function(header: string) {
        return this.headers[header.toLowerCase()];
      },
      header: function(header: string) {
        return this.headers[header.toLowerCase()];
      },
      is: function() { return false; },
      session: {},
      user: undefined,
      isAuthenticated: function() { return !!this.user; },
      login: function(user: any, callback: any) {
        this.user = user;
        if (callback) callback();
      },
      logout: function(callback: any) {
        this.user = undefined;
        if (callback) callback();
      }
    } as any;

    // Parse body if it's JSON
    if (req.body && typeof req.body === 'string') {
      try {
        if (req.headers['content-type']?.includes('application/json')) {
          req.body = JSON.parse(req.body);
        }
      } catch (e) {
        // Keep as string if parsing fails
      }
    }

    let responseFinished = false;

    // Create a more complete response mock
    const res = {
      statusCode: 200,
      headers: {},
      body: '',
      locals: {},
      headersSent: false,
      status: function(code: number) {
        this.statusCode = code;
        return this;
      },
      json: function(data: any) {
        if (responseFinished) return this;
        responseFinished = true;
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
        if (responseFinished) return this;
        responseFinished = true;
        this.body = typeof data === 'string' ? data : JSON.stringify(data);
        if (typeof data === 'object') {
          this.headers['Content-Type'] = 'application/json';
        }
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
      getHeader: function(name: string) {
        return this.headers[name];
      },
      redirect: function(url: string) {
        if (responseFinished) return this;
        responseFinished = true;
        this.statusCode = 302;
        this.headers['Location'] = url;
        resolve({
          statusCode: this.statusCode,
          headers: this.headers,
          body: '',
        });
        return this;
      },
      clearCookie: function(name: string, options: any = {}) {
        let cookieString = `${name}=; Path=${options.path || '/'}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        if (options.httpOnly) cookieString += '; HttpOnly';
        if (options.secure) cookieString += '; Secure';
        if (options.sameSite) cookieString += `; SameSite=${options.sameSite}`;
        
        this.headers['Set-Cookie'] = this.headers['Set-Cookie'] 
          ? [].concat(this.headers['Set-Cookie'], cookieString)
          : cookieString;
        return this;
      },
      cookie: function(name: string, value: string, options: any = {}) {
        let cookieString = `${name}=${value}`;
        if (options.path) cookieString += `; Path=${options.path}`;
        if (options.maxAge) cookieString += `; Max-Age=${options.maxAge}`;
        if (options.expires) cookieString += `; Expires=${options.expires.toUTCString()}`;
        if (options.httpOnly) cookieString += '; HttpOnly';
        if (options.secure) cookieString += '; Secure';
        if (options.sameSite) cookieString += `; SameSite=${options.sameSite}`;
        
        this.headers['Set-Cookie'] = this.headers['Set-Cookie'] 
          ? [].concat(this.headers['Set-Cookie'], cookieString)
          : cookieString;
        return this;
      },
      end: function(data?: any) {
        if (responseFinished) return this;
        responseFinished = true;
        if (data) this.body = data;
        resolve({
          statusCode: this.statusCode,
          headers: this.headers,
          body: this.body,
        });
        return this;
      }
    } as any;

    try {
      // Set up a timeout to prevent hanging requests
      const timeout = setTimeout(() => {
        if (!responseFinished) {
          responseFinished = true;
          resolve({
            statusCode: 504,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Request timeout' }),
          });
        }
      }, 25000); // 25 second timeout

      // Handle the request with Express app
      app(req, res, (err?: any) => {
        clearTimeout(timeout);
        if (!responseFinished) {
          responseFinished = true;
          if (err) {
            console.error('Express error:', err);
            resolve({
              statusCode: 500,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: 'Internal server error' }),
            });
          } else {
            // 404 handler
            resolve({
              statusCode: 404,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: 'Not found' }),
            });
          }
        }
      });
    } catch (error) {
      console.error('Handler error:', error);
      if (!responseFinished) {
        resolve({
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Internal server error' }),
        });
      }
    }
  });
};
