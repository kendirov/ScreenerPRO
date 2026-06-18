"use client";

import * as React from "react";

const LEVERAGE_ANIM_MS = 380;

/** true во время drag слайдера плеча и ~380ms после любого изменения leverage. */
export function useLeverageInteractionActive(leverage: number, dragging: boolean): boolean {
  const [animating, setAnimating] = React.useState(false);
  const prevLeverage = React.useRef(leverage);

  React.useEffect(() => {
    if (prevLeverage.current === leverage) return;
    prevLeverage.current = leverage;
    setAnimating(true);
    const id = window.setTimeout(() => setAnimating(false), LEVERAGE_ANIM_MS);
    return () => window.clearTimeout(id);
  }, [leverage]);

  return dragging || animating;
}
