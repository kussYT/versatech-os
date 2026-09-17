"use client";

import { useState, type ReactNode } from "react";
import { CreatePaymentDialog } from "@/components/finances/create-payment-dialog";
import { Button } from "@/components/ui/button";
import type { PaymentFormOptions } from "@/lib/queries/payments";

type CreatePaymentButtonProps = {
  options: PaymentFormOptions;
  children: ReactNode;
};

export function CreatePaymentButton({ options, children }: CreatePaymentButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>{children}</Button>
      <CreatePaymentDialog open={open} onClose={() => setOpen(false)} options={options} />
    </>
  );
}
