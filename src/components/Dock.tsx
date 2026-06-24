import { type ReactNode, type KeyboardEvent, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
} from "motion/react";
import type { SpringOptions, MotionValue } from "motion/react";

export interface DockItemData {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
  active?: boolean;
}

function DockItem({
  icon,
  label,
  onClick,
  className = "",
  active,
  mouseY,
  spring,
  distance,
  magnification,
  baseItemSize,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  className?: string;
  active?: boolean;
  mouseY: MotionValue<number>;
  spring: SpringOptions;
  distance: number;
  magnification: number;
  baseItemSize: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  const mouseDistance = useTransform(mouseY, (val) => {
    const rect = ref.current?.getBoundingClientRect() ?? {
      y: 0,
      height: baseItemSize,
    };
    return val - rect.y - rect.height / 2;
  });

  const targetSize = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [baseItemSize, magnification, baseItemSize]
  );
  const size = useSpring(targetSize, spring);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <motion.div
      ref={ref}
      style={{ width: size, height: size }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={onClick}
      className={`dock-item${active ? " dock-active" : ""} ${className}`}
      tabIndex={0}
      role="button"
      aria-label={label}
      onKeyDown={handleKeyDown}
    >
      <div className="dock-icon">{icon}</div>
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, x: 0 }}
            animate={{ opacity: 1, x: 8 }}
            exit={{ opacity: 0, x: 0 }}
            transition={{ duration: 0.15 }}
            className="dock-label"
            role="tooltip"
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Dock({
  items,
  className = "",
  spring = { mass: 0.1, stiffness: 150, damping: 12 },
  magnification = 58,
  distance = 140,
  baseItemSize = 44,
}: {
  items: DockItemData[];
  className?: string;
  spring?: SpringOptions;
  magnification?: number;
  distance?: number;
  baseItemSize?: number;
}) {
  const mouseY = useMotionValue(Infinity);

  return (
    <div
      className={`dock-v ${className}`}
      onMouseMove={(e) => mouseY.set(e.pageY)}
      onMouseLeave={() => mouseY.set(Infinity)}
      role="toolbar"
      aria-label="Navigasyon"
    >
      {items.map((item, index) => (
        <DockItem
          key={index}
          icon={item.icon}
          label={item.label}
          onClick={item.onClick}
          className={item.className}
          active={item.active}
          mouseY={mouseY}
          spring={spring}
          distance={distance}
          magnification={magnification}
          baseItemSize={baseItemSize}
        />
      ))}
    </div>
  );
}
