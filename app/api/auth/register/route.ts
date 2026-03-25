import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }
  if (username.length < 2 || username.length > 20) {
    return NextResponse.json({ error: "Username must be 2-20 characters" }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return NextResponse.json({ error: "Username can only contain letters, numbers, _ and -" }, { status: 400 });
  }

  const existing = await prisma.player.findUnique({ where: { name: username } });
  if (existing) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const player = await prisma.player.create({
    data: { name: username, password: hashed },
  });

  // Set session cookie
  const sessionData = JSON.stringify({ id: player.id, name: player.name });
  const response = NextResponse.json({ id: player.id, name: player.name }, { status: 201 });
  response.cookies.set("session", Buffer.from(sessionData).toString("base64"), {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
  return response;
}
