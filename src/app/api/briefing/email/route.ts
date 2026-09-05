import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { sendBriefingEmail } from "@/lib/email";

const inputSchema = z.object({ text: z.string().trim().min(1).max(12000) });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { text } = inputSchema.parse(await request.json());
    const sent = await sendBriefingEmail(user.email, text);
    if (!sent) return NextResponse.json({ error: "Email delivery is not configured" }, { status: 503 });
    return NextResponse.json({ sent: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid briefing" }, { status: 400 });
    return NextResponse.json({ error: "Unable to send briefing" }, { status: 500 });
  }
}