import { useLayoutEffect, useState } from "react";

export type AnchoredPopoverPlacement =
  | "above-right"
  | "center-right"
  | "below-right"
  | "top-right";

interface Position {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}

interface Options {
  placement?: AnchoredPopoverPlacement;
  offsetX?: number;
  offsetY?: number;
}

export function useAnchoredFixedPosition(
  open: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
  options: Options = {}
): Position | null {
  const { placement = "above-right", offsetX = 8, offsetY = 8 } = options;
  const [position, setPosition] = useState<Position | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPosition(null);
      return;
    }

    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();

      if (placement === "center-right") {
        setPosition({
          left: rect.right + offsetX,
          bottom: window.innerHeight - rect.bottom,
        });
        return;
      }

      if (placement === "top-right") {
        setPosition({
          left: rect.right + offsetX,
          top: rect.top,
        });
        return;
      }

      if (placement === "below-right") {
        setPosition({
          top: rect.bottom + offsetY,
          right: window.innerWidth - rect.right,
        });
        return;
      }

      setPosition({
        left: rect.right + offsetX,
        bottom: window.innerHeight - rect.top + offsetY,
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef, placement, offsetX, offsetY]);

  return position;
}
