import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const TourSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(40).optional().or(z.literal("")),
  property: z.enum(["Tantra Hill", "Sakumono Estate", "Nii Ayi Mensah"]),
  preferredDate: z.string(), // ISO date
  partySize: z.number().int().min(1).max(20).default(2),
  virtual: z.boolean().default(false),
  notes: z.string().max(2000).optional().or(z.literal("")),
  honeypot: z.string().optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.honeypot) {
      return NextResponse.json({ success: true, id: "spam-trap" });
    }

    const parsed = TourSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const tour = await db.tourBooking.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        property: parsed.data.property,
        preferredDate: new Date(parsed.data.preferredDate),
        partySize: parsed.data.partySize,
        virtual: parsed.data.virtual,
        notes: parsed.data.notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      id: tour.id,
      message: "Tour request received. We will confirm within 2 business hours.",
    });
  } catch (err) {
    console.error("Tour booking error:", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
