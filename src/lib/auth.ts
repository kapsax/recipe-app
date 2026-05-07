import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        (session.user as { id: string }).id = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { onboarded: true, preferences: true, dietType: true, onDiet: true },
        });
        (session.user as { onboarded: boolean }).onboarded =
          dbUser?.onboarded ?? false;
        (session.user as { preferences: string | null }).preferences =
          dbUser?.preferences ?? null;
        (session.user as unknown as { dietType: string }).dietType =
          dbUser?.dietType ?? "both";
        (session.user as unknown as { onDiet: boolean }).onDiet =
          dbUser?.onDiet ?? false;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};
