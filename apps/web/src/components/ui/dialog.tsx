"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { forwardRef } from "react";

/**
 * Accessible Dialog primitive (Radix + Tailwind). Dark-theme compatible.
 * Focus trap, ESC close, overlay click close, no background scroll when open.
 */
const Dialog = RadixDialog.Root;
const DialogTrigger = RadixDialog.Trigger;
const DialogPortal = RadixDialog.Portal;
const DialogClose = RadixDialog.Close;

const DialogOverlay = forwardRef<
  React.ComponentRef<typeof RadixDialog.Overlay>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Overlay>
>(({ className = "", ...props }, ref) => (
  <RadixDialog.Overlay
    ref={ref}
    className={`fixed inset-0 z-50 bg-black/60 opacity-0 data-[state=open]:opacity-100 transition-opacity duration-200 ${className}`}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

const DialogContent = forwardRef<
  React.ComponentRef<typeof RadixDialog.Content>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Content>
>(({ className = "", children, ...props }, ref) => (
  <RadixDialog.Content
    ref={ref}
    className={`fixed left-[50%] top-[50%] z-50 grid w-full max-w-3xl translate-x-[-50%] translate-y-[-50%] gap-4 border border-white/10 bg-zinc-900 p-6 shadow-xl shadow-black/40 duration-200 opacity-0 data-[state=open]:opacity-100 transition-opacity sm:rounded-xl mx-4 sm:mx-0 ${className}`}
    {...props}
  >
    {children}
  </RadixDialog.Content>
));
DialogContent.displayName = "DialogContent";

function DialogHeader({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex flex-col space-y-1.5 text-left sm:flex-row sm:items-center sm:justify-between ${className}`}
      {...props}
    />
  );
}

const DialogTitle = forwardRef<
  React.ComponentRef<typeof RadixDialog.Title>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Title>
>(({ className = "", ...props }, ref) => (
  <RadixDialog.Title
    ref={ref}
    className={`text-lg font-semibold leading-none tracking-tight text-zinc-100 ${className}`}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
};
