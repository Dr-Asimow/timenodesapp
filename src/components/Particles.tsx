import { useEffect } from "react";

export type Burst = {
  id: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
};

// Kaynaktan (üst çubuk / popup) hedef hücreye uçan yeşil glow'lu partiküller
export function FlyParticles({
  bursts,
  onDone,
}: {
  bursts: Burst[];
  onDone: (id: number) => void;
}) {
  if (bursts.length === 0) return null;
  return (
    <div className="particle-layer">
      {bursts.map((b) => (
        <BurstFx key={b.id} burst={b} onDone={() => onDone(b.id)} />
      ))}
    </div>
  );
}

function BurstFx({ burst, onDone }: { burst: Burst; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const N = 16;
  const dx = burst.to.x - burst.from.x;
  const dy = burst.to.y - burst.from.y;

  return (
    <>
      {Array.from({ length: N }).map((_, i) => {
        const spreadX = (Math.random() - 0.5) * 46;
        const spreadY = (Math.random() - 0.5) * 46;
        const size = 6 + Math.random() * 9;
        const delay = Math.random() * 0.18;
        const dur = 0.85 + Math.random() * 0.35;
        return (
          <span
            key={i}
            className="particle"
            style={{
              left: burst.from.x,
              top: burst.from.y,
              width: size,
              height: size,
              // hedefe + rastgele yayılma
              ["--dx" as string]: `${dx + spreadX}px`,
              ["--dy" as string]: `${dy + spreadY}px`,
              animationDelay: `${delay}s`,
              animationDuration: `${dur}s`,
            }}
          />
        );
      })}
    </>
  );
}
