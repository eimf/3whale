"use client";

import * as RadixTooltip from "@radix-ui/react-tooltip";
import { forwardRef } from "react";

const TooltipProvider = RadixTooltip.Provider;
const TooltipRoot = RadixTooltip.Root;
const TooltipTrigger = RadixTooltip.Trigger;
const TooltipPortal = RadixTooltip.Portal;

const TooltipContent = forwardRef<
  React.ComponentRef<typeof RadixTooltip.Content>,
  React.ComponentPropsWithoutRef<typeof RadixTooltip.Content>
>(({ className = "", sideOffset = 6, ...props }, ref) => (
  <RadixTooltip.Content
    ref={ref}
    sideOffset={sideOffset}
    className={`z-50 max-w-xs rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 shadow-lg data-[state=delayed-open]:data-[side=top]:animate-in data-[state=delayed-open]:data-[side=bottom]:animate-in data-[state=delayed-open]:data-[side=left]:animate-in data-[state=delayed-open]:data-[side=right]:animate-in ${className}`}
    {...props}
  />
));
TooltipContent.displayName = "TooltipContent";

export { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipPortal, TooltipContent };
