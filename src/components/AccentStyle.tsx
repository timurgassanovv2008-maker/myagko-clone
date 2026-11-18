// Акцентный цвет компании из настроек: переопределяет фирменный зелёный в обеих темах.

function inkFor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.55 ? "#151515" : "#ffffff";
}

export function AccentStyle({ accent }: { accent: string }) {
  if (!/^#[0-9a-fA-F]{6}$/.test(accent)) return null;
  const css = `
:root{--accent:${accent};--accent-hover:color-mix(in oklab,${accent} 82%,black);--accent-soft:color-mix(in oklab,${accent} 16%,white);--accent-ink:${inkFor(accent)}}
@media (prefers-color-scheme: dark){:root{--accent:color-mix(in oklab,${accent} 55%,white);--accent-hover:color-mix(in oklab,${accent} 40%,white);--accent-soft:color-mix(in oklab,${accent} 28%,#141312);--accent-ink:#111}}`;
  return <style>{css}</style>;
}
