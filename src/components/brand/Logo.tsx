import { preload } from "react-dom";
import { STORE } from "@/lib/store";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/brand/frontyard-logo.png";

/**
 * The Frontyard wordmark, drawn with a CSS mask so it takes the current text
 * colour (espresso on cream, cream on espresso) from a single transparent PNG.
 * Size it with a width or height class; the aspect ratio is fixed.
 */
export function Logo({ className }: { className?: string }) {
  preload(LOGO_SRC, { as: "image" });

  return (
    <span
      role="img"
      aria-label={STORE.name}
      className={cn("block aspect-[614/341] bg-current", className)}
      style={{
        maskImage: `url(${LOGO_SRC})`,
        WebkitMaskImage: `url(${LOGO_SRC})`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}
