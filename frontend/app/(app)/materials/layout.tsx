import type { ReactNode } from "react";

export default function MaterialsLayout({ children }: { children: ReactNode }) {
  return <div className="space-y-3 py-2">{children}</div>;
}
