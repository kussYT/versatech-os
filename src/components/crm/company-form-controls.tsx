"use client";

import type {
  InputHTMLAttributes,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { controlClassName } from "@/components/ui/field";
import { cn } from "@/lib/cn";

type ValueProps = {
  value: string;
  onValue: (value: string) => void;
};

export function CompanyTextInput({
  value,
  onValue,
  className,
  inputRef,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> &
  ValueProps & { inputRef?: Ref<HTMLInputElement> }) {
  return (
    <input
      {...props}
      ref={inputRef}
      value={value}
      onChange={(event) => onValue(event.target.value)}
      className={cn(controlClassName, className)}
    />
  );
}

export function CompanyTextArea({
  value,
  onValue,
  className,
  ...props
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & ValueProps) {
  return (
    <textarea
      {...props}
      value={value}
      onChange={(event) => onValue(event.target.value)}
      className={cn(controlClassName, "min-h-24 resize-y", className)}
    />
  );
}

export function CompanySelect({
  value,
  onValue,
  className,
  children,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange"> & ValueProps) {
  return (
    <select
      {...props}
      value={value}
      onChange={(event) => onValue(event.target.value)}
      className={cn(controlClassName, className)}
    >
      {children}
    </select>
  );
}
