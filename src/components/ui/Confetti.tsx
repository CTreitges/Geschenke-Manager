// ── Confetti ───────────────────────────────────────────────────
export function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  const dots = Array.from({ length: 18 }, (_, i) => ({
    left: `${(i * 7 + 5) % 100}%`,
    delay: (i * 0.18) % 3,
    // Farben aus den Illustrations-Tokens (index.css)
    color: ["var(--ill-grad-from)", "var(--ill-spark-1)", "var(--ill-spark-2)", "var(--ill-spark-3)", "var(--ill-p-ben)"][i % 5],
    size: 4 + (i % 3) * 2,
  }));
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit]">
      {dots.map((d, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: -10,
            left: d.left,
            width: d.size,
            height: d.size * 1.4,
            background: d.color,
            borderRadius: 1,
            opacity: 0.7,
            animation: `confettiFall 3.4s linear ${d.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
