import type { ReactNode } from "react";
import { AuthHeader } from "@/components/auth-header";

export default function InviteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthHeader />
      {children}
    </>
  );
}
