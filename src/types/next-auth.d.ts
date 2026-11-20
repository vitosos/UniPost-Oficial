import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: number;
    pwf?: string;
  }

  interface Session {
    user?: DefaultSession["user"] & { id: number };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: number;
    pwf?: string;
    checkedAt?: number;
  }
}
