import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }

  const player = await prisma.player.findUnique({ where: { name: username } });
  if (!player || !player.password) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, player.password);
  if (!valid) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const sessionData = JSON.stringify({ id: player.id, name: player.name, avatar: player.discordAvatar });
  const response = NextResponse.json({ id: player.id, name: player.name });
  response.cookies.set("session", Buffer.from(sessionData).toString("base64"), {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
  return response;
}
