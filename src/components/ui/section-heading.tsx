import { cn } from "@/lib/utils";

export function SectionHeading({
  heading,
  subheading,
  align = "center",
  id,
}: {
  heading: string;
  subheading?: string;
  align?: "center" | "left";
  id?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      <h2 id={id} className="font-heading text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
        {heading}
      </h2>
      {subheading && <p className="mt-4 text-lg text-pretty text-muted-foreground">{subheading}</p>}
    </div>
  );
}
