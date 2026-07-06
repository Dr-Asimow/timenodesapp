import type { ReactNode } from "react";

// Aç/kapa içerikler için yumuşak yükseklik geçişi.
// grid-template-rows 0fr→1fr hilesiyle "height: auto" animasyonu yapılır;
// içerik hep mount kalır, kapalıyken visibility:hidden ile etkileşim kesilir.
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={`collapse${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="collapse-inner">{children}</div>
    </div>
  );
}
