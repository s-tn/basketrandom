import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', request.url));
  }

  // Exchange code for token
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI || 'http://localhost:9000/api/auth/discord/callback',
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/?error=token_failed', request.url));
  }

  const tokenData = await tokenRes.json();

  // Get user info
  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userRes.ok) {
    return NextResponse.redirect(new URL('/?error=user_failed', request.url));
  }

  const discordUser = await userRes.json();

  // Upsert player
  const player = await prisma.player.upsert({
    where: { discordId: discordUser.id },
    create: {
      name: discordUser.username,
      discordId: discordUser.id,
      discordName: discordUser.username,
      discordAvatar: discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : null,
    },
    update: {
      discordName: discordUser.username,
      discordAvatar: discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : null,
    },
  });

  // Set a simple session cookie (player ID + name)
  const sessionData = JSON.stringify({ id: player.id, name: player.name, avatar: player.discordAvatar });
  const response = NextResponse.redirect(new URL('/profile', request.url));
  response.cookies.set('session', Buffer.from(sessionData).toString('base64'), {
    httpOnly: false, // Need JS access for client components
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/',
  });

  return response;
}
