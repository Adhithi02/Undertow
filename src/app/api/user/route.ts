import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE_NAME, getOrCreateUser, signUserId } from "@/lib/auth";

const userInputSchema = z.object({ email: z.string().email().transform(email => email.toLowerCase()) });
const userOutputSchema = z.object({ id: z.string(), email: z.string().email() });

export async function POST(request: Request) {
  try {
    const input = userInputSchema.parse(await request.json());
    const user = await getOrCreateUser(input.email);
    const output = userOutputSchema.parse(user);
    const response = NextResponse.json(output);
    response.cookies.set(AUTH_COOKIE_NAME, signUserId(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create user" }, { status: 500 });
  }
}