import type { CategoryId } from "@/lib/pricing/catalog";

// Плоские иллюстрации мебели. Сейчас — основная картинка выбора,
// после появления 3D — постер на время загрузки и запасной вариант без WebGL.

type Props = { category: CategoryId; className?: string; title?: string };

export function FurniturePoster({ category, className, title }: Props) {
  return (
    <svg viewBox="0 0 400 300" className={className} role="img" aria-label={title ?? TITLES[category]}>
      <ellipse cx="200" cy="262" rx={category === "chair" ? 90 : 150} ry="13" fill="var(--shade)" />
      {SHAPES[category]}
    </svg>
  );
}

const TITLES: Record<CategoryId, string> = {
  sofa: "Диван",
  armchair: "Кресло",
  mattress: "Матрас",
  chair: "Стул",
  other: "Другая мебель",
};

const hi = "rgba(255,255,255,0.22)";
const lo = "rgba(0,0,0,0.12)";

const SHAPES: Record<CategoryId, React.ReactNode> = {
  sofa: (
    <g>
      <rect x="78" y="236" width="12" height="24" rx="4" fill="var(--wood)" />
      <rect x="310" y="236" width="12" height="24" rx="4" fill="var(--wood)" />
      <rect x="66" y="92" width="268" height="104" rx="30" fill="var(--fabric-sofa)" />
      <rect x="66" y="92" width="268" height="104" rx="30" fill={lo} opacity="0.5" />
      <rect x="82" y="104" width="114" height="82" rx="22" fill="var(--fabric-sofa)" />
      <rect x="204" y="104" width="114" height="82" rx="22" fill="var(--fabric-sofa)" />
      <rect x="90" y="110" width="98" height="18" rx="9" fill={hi} />
      <rect x="212" y="110" width="98" height="18" rx="9" fill={hi} />
      <rect x="52" y="176" width="296" height="64" rx="20" fill="var(--fabric-sofa)" />
      <rect x="84" y="170" width="114" height="36" rx="14" fill="var(--fabric-sofa)" stroke={lo} strokeWidth="2" />
      <rect x="202" y="170" width="114" height="36" rx="14" fill="var(--fabric-sofa)" stroke={lo} strokeWidth="2" />
      <rect x="34" y="140" width="52" height="100" rx="24" fill="var(--fabric-sofa)" />
      <rect x="314" y="140" width="52" height="100" rx="24" fill="var(--fabric-sofa)" />
      <rect x="40" y="146" width="40" height="14" rx="7" fill={hi} />
      <rect x="320" y="146" width="40" height="14" rx="7" fill={hi} />
    </g>
  ),
  armchair: (
    <g>
      <rect x="122" y="236" width="12" height="24" rx="4" fill="var(--wood)" />
      <rect x="266" y="236" width="12" height="24" rx="4" fill="var(--wood)" />
      <path d="M118 120 Q118 70 200 70 Q282 70 282 120 L282 196 L118 196 Z" fill="var(--fabric-armchair)" />
      <path d="M118 120 Q118 70 200 70 Q282 70 282 120 L282 196 L118 196 Z" fill={lo} opacity="0.4" />
      <rect x="134" y="92" width="132" height="96" rx="30" fill="var(--fabric-armchair)" />
      <rect x="146" y="100" width="108" height="20" rx="10" fill={hi} />
      <rect x="104" y="176" width="192" height="64" rx="20" fill="var(--fabric-armchair)" />
      <rect x="130" y="168" width="140" height="38" rx="15" fill="var(--fabric-armchair)" stroke={lo} strokeWidth="2" />
      <rect x="88" y="136" width="50" height="104" rx="24" fill="var(--fabric-armchair)" />
      <rect x="262" y="136" width="50" height="104" rx="24" fill="var(--fabric-armchair)" />
      <rect x="94" y="142" width="38" height="14" rx="7" fill={hi} />
      <rect x="268" y="142" width="38" height="14" rx="7" fill={hi} />
    </g>
  ),
  mattress: (
    <g>
      {/* верхняя грань */}
      <path d="M70 150 L130 104 L350 104 L330 150 Z" fill="var(--fabric-mattress)" />
      <path d="M70 150 L130 104 L350 104 L330 150 Z" fill={lo} opacity="0.15" />
      {/* стёжка */}
      {[0.25, 0.5, 0.75].map((v) =>
        [1, 2, 3, 4, 5, 6].map((c) => {
          const u = c / 7;
          const x = (70 + 260 * u) * (1 - v) + (130 + 220 * u) * v;
          return <circle key={`${v}-${c}`} cx={x} cy={150 - 46 * v} r="2.6" fill={lo} />;
        }),
      )}
      {/* боковые грани */}
      <path d="M330 150 L350 104 L350 186 L330 236 Z" fill="var(--fabric-mattress)" />
      <path d="M330 150 L350 104 L350 186 L330 236 Z" fill={lo} opacity="0.35" />
      <rect x="70" y="150" width="260" height="86" rx="6" fill="var(--fabric-mattress)" />
      {/* кант и полосы боковины */}
      <rect x="70" y="150" width="260" height="6" rx="3" fill="var(--fabric-mattress-2)" />
      <rect x="70" y="230" width="260" height="6" rx="3" fill="var(--fabric-mattress-2)" />
      <rect x="70" y="174" width="260" height="38" fill="var(--fabric-mattress-2)" opacity="0.35" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={86 + i * 34} y="186" width="18" height="14" rx="3" fill="var(--fabric-mattress)" opacity="0.8" />
      ))}
      {/* ручка */}
      <rect x="180" y="198" width="40" height="8" rx="4" fill="var(--fabric-mattress-2)" />
    </g>
  ),
  chair: (
    <g>
      <rect x="146" y="176" width="10" height="86" rx="4" fill="var(--wood)" />
      <rect x="244" y="176" width="10" height="86" rx="4" fill="var(--wood)" />
      <rect x="162" y="176" width="8" height="74" rx="4" fill="var(--wood)" opacity="0.75" />
      <rect x="230" y="176" width="8" height="74" rx="4" fill="var(--wood)" opacity="0.75" />
      <rect x="148" y="60" width="10" height="120" rx="4" fill="var(--wood)" />
      <rect x="242" y="60" width="10" height="120" rx="4" fill="var(--wood)" />
      <rect x="140" y="56" width="120" height="76" rx="24" fill="var(--fabric-chair)" />
      <rect x="152" y="64" width="96" height="16" rx="8" fill={hi} />
      <rect x="132" y="162" width="136" height="32" rx="14" fill="var(--fabric-chair)" />
      <rect x="132" y="180" width="136" height="14" rx="7" fill={lo} />
      <rect x="144" y="166" width="112" height="10" rx="5" fill={hi} />
    </g>
  ),
  other: (
    <g>
      <rect x="108" y="150" width="184" height="92" rx="16" fill="var(--fabric-other)" />
      <rect x="108" y="150" width="184" height="92" rx="16" fill={lo} opacity="0.4" />
      <ellipse cx="200" cy="150" rx="92" ry="30" fill="var(--fabric-other)" />
      <ellipse cx="200" cy="146" rx="70" ry="18" fill={hi} />
      {[150, 200, 250].map((x) => (
        <circle key={x} cx={x} cy={150} r="3.5" fill={lo} />
      ))}
      <rect x="126" y="240" width="12" height="16" rx="3" fill="var(--wood)" />
      <rect x="262" y="240" width="12" height="16" rx="3" fill="var(--wood)" />
      <text x="200" y="210" textAnchor="middle" fontSize="40" fontWeight="700" fill="rgba(255,255,255,0.7)">?</text>
    </g>
  ),
};
