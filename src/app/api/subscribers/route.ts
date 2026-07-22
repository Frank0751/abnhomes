import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const SubSchema = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional(),
  language: z.enum(["en", "fr"]).default("en"),
  source: z.string().max(40).default("website"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SubSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid email" }, { status: 400 });
    }

    const subscriber = await db.subscriber.upsert({
      where: { email: parsed.data.email },
      update: { name: parsed.data.name, language: parsed.data.language },
      create: {
        email: parsed.data.email,
        name: parsed.data.name,
        language: parsed.data.language,
        source: parsed.data.source,
      },
    });

    return NextResponse.json({
      success: true,
      id: subscriber.id,
      message: "You are subscribed to ABN Homes updates.",
    });
  } catch (err) {
    console.error("Subscribe error:", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
