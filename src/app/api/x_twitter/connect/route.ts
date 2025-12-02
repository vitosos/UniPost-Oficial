import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { TwitterApi } from "twitter-api-v2";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));

  // Cliente temporal solo con claves de app
  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY!,
    appSecret: process.env.TWITTER_API_SECRET!,
  });

  const callbackUrl = process.env.TWITTER_REDIRECT_URI!;

  try {
    // Generar Link de Auth (OAuth 1.0a)
    const authLink = await client.generateAuthLink(callbackUrl, { linkMode: 'authorize' });

    const response = NextResponse.redirect(authLink.url);

    // Guardamos el token secreto temporal (oauth_token_secret) en una cookie
    // Lo necesitamos en el callback para verificar la firma
    response.cookies.set("twitter_oauth_secret", authLink.oauth_token_secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600, // 10 min
    });

    return response;
  } catch (error) {
    console.error("Error generando link X:", error);
    return NextResponse.json({ error: "Error conectando con X" }, { status: 500 });
  }
}