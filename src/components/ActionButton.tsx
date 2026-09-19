import { Button } from "@radix-ui/themes";
import { useReducedMotion } from "motion/react";
import * as motion from "motion/react-m";
import type { ComponentProps } from "react";

const MotionButton = motion.create(Button);

type Props = ComponentProps<typeof MotionButton>;

export function ActionButton({ className = "", ...props }: Props) {
  const reducedMotion = useReducedMotion();

  return (
    <MotionButton
      {...props}
      className={`action-button ${className}`}
      whileTap={props.disabled || reducedMotion ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", bounce: 0, duration: 0.25 }}
    />
  );
}
