const S = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function IconTarget({ size = 16 }: { size?: number }) {
  return (
    <svg {...S} width={size} height={size}>
      <circle cx="8" cy="8" r="6.5" />
      <circle cx="8" cy="8" r="3.5" />
      <circle cx="8" cy="8" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconBell({ size = 16 }: { size?: number }) {
  return (
    <svg {...S} width={size} height={size}>
      <path d="M6 13a2 2 0 0 0 4 0" />
      <path d="M12 7c0-2.8-1.8-5-4-5S4 4.2 4 7c0 3-1.5 4.5-2 5h12c-.5-.5-2-2-2-5z" />
    </svg>
  );
}

export function IconCheck({ size = 16 }: { size?: number }) {
  return (
    <svg {...S} width={size} height={size} strokeWidth={2}>
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  );
}

export function IconCoin({ size = 16 }: { size?: number }) {
  return (
    <svg {...S} width={size} height={size}>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M9.5 5.5C9.2 5 8.6 4.8 8 4.8S6.5 5.2 6.5 5.8c0 .8 1.5 1 1.5 1s1.5.3 1.5 1.2c0 .6-.6 1.2-1.5 1.2S6.8 9 6.5 8.5" />
      <path d="M8 4v1M8 11v1" strokeWidth={1.2} />
    </svg>
  );
}

export function IconCopy({ size = 16 }: { size?: number }) {
  return (
    <svg {...S} width={size} height={size}>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5V3.5A1.5 1.5 0 0 0 9 2H3.5A1.5 1.5 0 0 0 2 3.5V9a1.5 1.5 0 0 0 1.5 1.5h2" />
    </svg>
  );
}

export function IconNote({ size = 16 }: { size?: number }) {
  return (
    <svg {...S} width={size} height={size}>
      <rect x="2.5" y="1.5" width="11" height="13" rx="1.5" />
      <path d="M5 5h6M5 8h6M5 11h3" />
    </svg>
  );
}

export function IconWarning({ size = 16 }: { size?: number }) {
  return (
    <svg {...S} width={size} height={size} strokeWidth={1.6}>
      <path d="M8 1.5 1 14h14z" />
      <path d="M8 6v3.5" />
      <circle cx="8" cy="11.8" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconMail({ size = 16 }: { size?: number }) {
  return (
    <svg {...S} width={size} height={size}>
      <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
      <path d="M1.5 4.5 8 9l6.5-4.5" />
    </svg>
  );
}

export function IconCircle({ size = 16 }: { size?: number }) {
  return (
    <svg {...S} width={size} height={size} strokeWidth={1.3}>
      <circle cx="8" cy="8" r="5.5" />
    </svg>
  );
}

export function IconPencil({ size = 16 }: { size?: number }) {
  return (
    <svg {...S} width={size} height={size}>
      <path d="M11 2.5 13.5 5 5 13.5 2 14l0.5-3L11 2.5Z" />
      <path d="M9.5 4 12 6.5" />
    </svg>
  );
}
