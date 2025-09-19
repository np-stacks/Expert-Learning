import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import express from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { registerRoutes } from "../../server/routes";
import { storage } from "../../server/storage";
import crypto from "crypto";

// Serverless-compatible password hashing using crypto
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, hashedPassword: string): boolean {
  const [salt, hash] = hashedPassword.split(':');
  const verifyHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === verifyHash;
}

// Override storage methods for Netlify compatibility
const netlifyStorage = {
  ...storage,
  createUser: async (userData: any) => {
    if (userData.password && userData.password !== "google-oauth") {
      userData.password = hashPassword(userData.password);
    }
    return storage.createUser(userData);
  },
  verifyUserPassword: async (username: string, password: string) => {
    const user = await storage.getUserByUsername(username);
    if (!user || user.password === "google-oauth") return null;

    const isValid = verifyPassword(password, user.password);
    return isValid ? user : null;
  }
};

// Create a singleton Express app
let app: express.Application | null = null;

function getApp() {
  if (app) return app;

  app = express();

  // Basic middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false, limit: '10mb' }));

  // Session configuration
  const sessionStore = new (MemoryStore(session))({
    checkPeriod: 86400000
  });

  app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'netlify-dev-secret',
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
        const existingUser = await netlifyStorage.getUserByUsername(profile.id);
        if (existingUser) {
          return done(null, existingUser);
        }

        const newUser = await netlifyStorage.createUser({
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
        const user = await netlifyStorage.getUser(id);
        done(null, user);
      } catch (error) {
        done(error, null);
      }
    });

    app.use(passport.initialize());
    app.use(passport.session());
  }

  // Register routes
  registerRoutes(app, netlifyStorage);

  return app;
}

// Convert Netlify event to Express-compatible request
function createExpressRequest(event: HandlerEvent): any {
  let apiPath = event.path.replace(/^\/\.netlify\/functions\/api/, '') || '/';
  
  if (event.queryStringParameters) {
    const queryString = new URLSearchParams(event.queryStringParameters).toString();
    if (queryString) {
      apiPath += '?' + queryString;
    }
  }

  const req = {
    method: event.httpMethod,
    url: apiPath,
    path: apiPath.split('?')[0],
    query: event.queryStringParameters || {},
    headers: event.headers || {},
    body: event.body,
    ip: event.headers['x-forwarded-for'] || '127.0.0.1',
    connection: { remoteAddress: event.headers['x-forwarded-for'] || '127.0.0.1' },
    originalUrl: apiPath,
    get: function(header: string) { return this.headers[header.toLowerCase()]; },
    header: function(header: string) { return this.headers[header.toLowerCase()]; },
    session: {},
    user: undefined,
    isAuthenticated: function() { return !!this.user; },
    login: function(user: any, callback: any) { this.user = user; if (callback) callback(); },
    logout: function(callback: any) { this.user = undefined; if (callback) callback(); },
    files: undefined,
    params: {},
    route: { path: apiPath },
    baseUrl: '',
    hostname: event.headers['host'] || 'localhost',
    protocol: event.headers['x-forwarded-proto'] || 'https',
    secure: true
  };

  // Parse JSON body if needed
  if (req.body && typeof req.body === 'string' && req.headers['content-type']?.includes('application/json')) {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {
      console.error('JSON parsing error:', e);
    }
  }

  return req;
}

// Convert Express response to Netlify response
function createExpressResponse(): any {
  let finished = false;
  let statusCode = 200;
  let headers: Record<string, any> = {};
  let responsePromise: Promise<any>;
  let resolveResponse: (value: any) => void;

  responsePromise = new Promise((resolve) => {
    resolveResponse = resolve;
  });

  const res = {
    statusCode,
    headers,
    status: function(code: number) { 
      statusCode = code; 
      this.statusCode = code;
      return this; 
    },
    json: function(data: any) {
      if (finished) return this;
      finished = true;
      headers['Content-Type'] = 'application/json';
      resolveResponse({
        statusCode: statusCode,
        headers: headers,
        body: JSON.stringify(data),
      });
      return this;
    },
    send: function(data: any) {
      if (finished) return this;
      finished = true;
      const body = typeof data === 'string' ? data : JSON.stringify(data);
      if (typeof data === 'object') headers['Content-Type'] = 'application/json';
      resolveResponse({
        statusCode: statusCode,
        headers: headers,
        body: body,
      });
      return this;
    },
    setHeader: function(name: string, value: string) { 
      headers[name] = value; 
      return this; 
    },
    redirect: function(url: string) {
      if (finished) return this;
      finished = true;
      statusCode = 302;
      headers['Location'] = url;
      resolveResponse({
        statusCode: statusCode,
        headers: headers,
        body: '',
      });
      return this;
    },
    clearCookie: function(name: string, options: any = {}) {
      const cookieString = `${name}=; Path=${options.path || '/'}; Expires=Thu, 01 Jan 1970 00:00:00 GMT${options.httpOnly ? '; HttpOnly' : ''}${options.secure ? '; Secure' : ''}${options.sameSite ? `; SameSite=${options.sameSite}` : ''}`;
      headers['Set-Cookie'] = headers['Set-Cookie'] 
        ? [].concat(headers['Set-Cookie'], cookieString)
        : cookieString;
      return this;
    },
    end: function(data?: any) {
      if (finished) return this;
      finished = true;
      resolveResponse({
        statusCode: statusCode,
        headers: headers,
        body: data || '',
      });
      return this;
    },
    getPromise: () => responsePromise
  };

  return res;
}

// Netlify function handler
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  process.env.NETLIFY_DEPLOYMENT = '1';
  
  try {
    const app = getApp();
    const req = createExpressRequest(event);
    const res = createExpressResponse();

    // Create a timeout promise
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          statusCode: 504,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Request timeout' }),
        });
      }, 25000);
    });

    // Handle the request
    try {
      app(req, res);
      
      // Wait for either the response or timeout
      const result = await Promise.race([
        res.getPromise(),
        timeoutPromise
      ]);

      return result;
    } catch (appError) {
      console.error('App handling error:', appError);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: 'Internal server error',
          error: appError instanceof Error ? appError.message : 'Unknown error'
        }),
      };
    }

  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};
