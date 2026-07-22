import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import crypto from "crypto";

const EnquirySchema = z.object({
  name: z.string().min(2, "Name is required").max(120),
  email: z.string().email("Valid email is required").max(200),
  phone: z.string().max(40).optional().or(z.literal("")),
  interest: z.string().max(80),
  message: z.string().min(5, "Message is required").max(4000),
  preferredDate: z.string().optional().or(z.literal("")),
  language: z.enum(["en", "fr"]).default("en"),
  source: z.string().max(40).default("website"),
  honeypot: z.string().optional().or(z.literal("")),
});

// Simple in-memory rate limit (per IP) - 5 submissions per hour
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip + process.env.DATABASE_URL).digest("hex").slice(0, 32);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Honeypot: if filled, silently succeed but do not save
    if (body.honeypot) {
      return NextResponse.json({ success: true, id: "spam-trap" }, { status: 200 });
    }

    const parsed = EnquirySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Rate limit by IP
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }

    const enquiry = await db.enquiry.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        interest: parsed.data.interest,
        message: parsed.data.message,
        preferredDate: parsed.data.preferredDate || null,
        language: parsed.data.language,
        source: parsed.data.source,
        ipHash: hashIp(ip),
        userAgent: req.headers.get("user-agent")?.slice(0, 500),
      },
    });

    // Fire and forget: notify team (would integrate with email/Slack/WhatsApp in production)
    try {
      const webhookUrl = process.env.ABN_WEBHOOK_URL;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `New ABN Homes enquiry from ${enquiry.name} (${enquiry.email}) about ${enquiry.interest}. Phone: ${enquiry.phone || "n/a"}. Message: ${enquiry.message.slice(0, 200)}`,
          }),
        });
      }
    } catch {
      // webhook failure should not block the response
    }

    return NextResponse.json({
      success: true,
      id: enquiry.id,
      message: "Enquiry received. Our team will contact you within 2 business hours.",
    });
  } catch (err) {
    console.error("Enquiry submission error:", err);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred. Please call 054 170 4048." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // Simple admin endpoint protected by token
  const authHeader = req.headers.get("authorization");
  const adminToken = process.env.ABN_ADMIN_TOKEN;
  if (!adminToken || authHeader !== `Bearer ${adminToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

  const where = status ? { status } : {};
  const enquiries = await db.enquiry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ success: true, count: enquiries.length, enquiries });
}
