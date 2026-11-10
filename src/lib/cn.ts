import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge kennt die eigenen Tokens aus tailwind.config.js nicht. Ohne
// diese Erweiterung hielte es z. B. `text-meta` für eine Textfarbe und würde
// es bei `cn("text-meta", "text-fg-muted")` stillschweigend verwerfen.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      borderRadius: ["tile", "btn", "card", "sheet"],
    },
    classGroups: {
      "font-size": [{ text: ["2xs", "meta", "body", "title", "display"] }],
      "bg-image": [{ bg: ["grad-primary", "grad-hero"] }],
      shadow: [{ shadow: ["card", "primary"] }],
      "min-h": [{ "min-h": ["tap"] }],
      "min-w": [{ "min-w": ["tap"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
