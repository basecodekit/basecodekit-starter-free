import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

/** The brand above the sign-in, sign-up and invite pages, linking home. */
export function AuthHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
        <Link href="/" className="font-heading text-base font-semibold">
          <BrandMark />
        </Link>
      </div>
    </header>
  );
}
