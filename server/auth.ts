import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Express, RequestHandler } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";

const PgSession = connectPgSimple(session);

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      themeId: string | null;
      isAdmin: string | null;
    }
  }
}

export function setupAuth(app: Express) {
  const sessionMiddleware = session({
    store: new PgSession({
      pool: pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "fallback-secret-key",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      maxAge: 15 * 60 * 1000,
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    },
  });

  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const user = await db
            .select()
            .from(users)
            .where(eq(users.email, email.toLowerCase()))
            .limit(1);

          if (user.length === 0) {
            return done(null, false, { message: "Invalid email or password" });
          }

          const isValid = await bcrypt.compare(password, user[0].password);
          if (!isValid) {
            return done(null, false, { message: "Invalid email or password" });
          }

          await db
            .update(users)
            .set({ lastLogin: new Date() })
            .where(eq(users.id, user[0].id));

          return done(null, {
            id: user[0].id,
            email: user[0].email,
            themeId: user[0].themeId,
            isAdmin: user[0].isAdmin,
          });
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (user.length === 0) {
        return done(null, false);
      }

      done(null, {
        id: user[0].id,
        email: user[0].email,
        themeId: user[0].themeId,
        isAdmin: user[0].isAdmin,
      });
    } catch (error) {
      done(error);
    }
  });

  return sessionMiddleware;
}

export const requireAuth: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Authentication required" });
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.user?.isAdmin !== "true") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

export const requireAdminToken: RequestHandler = (req, res, next) => {
  const token = req.headers["x-admin-token"] || req.query.token;
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    return res.status(500).json({ error: "Admin token not configured" });
  }

  if (token !== adminToken) {
    return res.status(403).json({ error: "Invalid admin token" });
  }

  next();
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function registerUser(email: string, password: string) {
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (existingUser.length > 0) {
    throw new Error("Email already registered");
  }

  const hashedPassword = await hashPassword(password);

  const newUser = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      password: hashedPassword,
      themeId: "bootstrap",
      isAdmin: "false",
    })
    .returning();

  return newUser[0];
}
