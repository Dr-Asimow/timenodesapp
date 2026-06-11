import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

// React Bits TiltedCard'ın tilt/hover mantığı — TS'e uyarlanmış, children tabanlı.
// Tek bir görsel yerine herhangi bir içeriği (örn. çok katmanlı BadgeCard) sarmalar;
// fareyle 3D eğim + hafif ölçek verir.
// Dokunmatik için: medya-sorgusu (hover/pointer) yerine OLAY bazında pointerType'a
// bakıyoruz — yalnızca parmak dokunuşunda (touch) eğimi atlıyoruz. Böylece dokunmatik
// ekranlı bilgisayarlarda fare/trackpad kullanınca eğim yine çalışır.
const springValues = { damping: 30, stiffness: 100, mass: 2 };

export function TiltedCard({
  children,
  rotateAmplitude = 8,
  scaleOnHover = 1.04,
  className = "",
}: {
  children: ReactNode;
  rotateAmplitude?: number;
  scaleOnHover?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useSpring(useMotionValue(0), springValues);
  const rotateY = useSpring(useMotionValue(0), springValues);
  const scale = useSpring(1, springValues);

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "touch") return; // dokunmatikte eğim yok
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;
    rotateX.set((offsetY / (rect.height / 2)) * -rotateAmplitude);
    rotateY.set((offsetX / (rect.width / 2)) * rotateAmplitude);
  }

  function handlePointerEnter(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "touch") return;
    scale.set(scaleOnHover);
  }

  function handlePointerLeave() {
    scale.set(1);
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <div
      ref={ref}
      className={`tilt-wrap ${className}`.trim()}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <motion.div className="tilt-inner" style={{ rotateX, rotateY, scale }}>
        {children}
      </motion.div>
    </div>
  );
}
