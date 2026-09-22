/**
 * Client-side color extractor from image or logo using HTML5 Canvas.
 * Extracts vibrant and dominant colors to suggest a matching palette.
 */

export interface ExtractedPalette {
  primary: string;
  secondary: string;
  accent: string;
  isLight: boolean;
}

export const DEFAULT_PALETTES = [
  { name: "Verde Ineitor (Padrão)", primary: "#10b981", secondary: "#065f46", accent: "#d1fae5" },
  { name: "Azul Corporativo", primary: "#2563eb", secondary: "#1e3a8a", accent: "#dbeafe" },
  { name: "Rosa Glamour (Manicure/Beleza)", primary: "#ec4899", secondary: "#9d174d", accent: "#fce7f3" },
  { name: "Laranja Oficina (Mecânica)", primary: "#f97316", secondary: "#9a3412", accent: "#ffedd5" },
  { name: "Roxo Moderno (Estética)", primary: "#8b5cf6", secondary: "#5b21b6", accent: "#ede9fe" },
  { name: "Âmbar & Madeira (Marcenaria)", primary: "#d97706", secondary: "#78350f", accent: "#fef3c7" },
  { name: "Grafite & Prata (Premium)", primary: "#334155", secondary: "#0f172a", accent: "#f1f5f9" },
];

export async function extractPaletteFromImage(imageSrc: string): Promise<ExtractedPalette | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }

        const size = 64;
        canvas.width = size;
        canvas.height = size;

        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;

        const colorCounts: Record<string, { r: number; g: number; b: number; count: number; sat: number }> = {};

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // Skip transparent or near-transparent pixels
          if (a < 128) continue;

          // Skip pure white or pure black
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          if (brightness > 245 || brightness < 15) continue;

          // Calculate saturation
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;

          // Group into quantized bins of 16
          const qr = Math.round(r / 24) * 24;
          const qg = Math.round(g / 24) * 24;
          const qb = Math.round(b / 24) * 24;
          const key = `${qr},${qg},${qb}`;

          if (!colorCounts[key]) {
            colorCounts[key] = { r: qr, g: qg, b: qb, count: 0, sat };
          }
          colorCounts[key].count += 1 + sat * 2; // boost saturated colors
        }

        const sorted = Object.values(colorCounts).sort((a, b) => b.count - a.count);

        if (sorted.length === 0) {
          resolve({
            primary: "#10b981",
            secondary: "#065f46",
            accent: "#d1fae5",
            isLight: false,
          });
          return;
        }

        const top = sorted[0];
        const primaryHex = rgbToHex(top.r, top.g, top.b);

        // Derive darker secondary and lighter accent
        const secondaryHex = adjustBrightness(primaryHex, -0.35);
        const accentHex = adjustBrightness(primaryHex, 0.45);

        const brightness = (top.r * 299 + top.g * 587 + top.b * 114) / 1000;

        resolve({
          primary: primaryHex,
          secondary: secondaryHex,
          accent: accentHex,
          isLight: brightness > 160,
        });
      } catch (err) {
        console.warn("Palette extraction error:", err);
        resolve(null);
      }
    };

    img.onerror = () => {
      resolve(null);
    };

    img.src = imageSrc;
  });
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function adjustBrightness(hex: string, factor: number): string {
  let clean = hex.replace("#", "");
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;

  let nr = r;
  let ng = g;
  let nb = b;

  if (factor > 0) {
    nr = r + (255 - r) * factor;
    ng = g + (255 - g) * factor;
    nb = b + (255 - b) * factor;
  } else {
    const dec = 1 + factor;
    nr = r * dec;
    ng = g * dec;
    nb = b * dec;
  }

  return rgbToHex(nr, ng, nb);
}
