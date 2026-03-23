import { PremiumLockCard } from "@/components/ui/primitives";

export function EntitlementBoundary({
  isAllowed,
  children,
  fallbackTitle,
  fallbackText,
}: {
  isAllowed: boolean;
  children?: React.ReactNode;
  fallbackTitle?: string;
  fallbackText?: string;
}) {
  if (!isAllowed) {
    return <PremiumLockCard title={fallbackTitle} text={fallbackText} />;
  }

  return <>{children ?? null}</>;
}
