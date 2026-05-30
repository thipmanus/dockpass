"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatDateDDMMYYYY,
  formatDateTimeDDMMYYYYHHmm,
  parseDDMMYYYYHHmmToLocalDateTime,
  parseDDMMYYYYToISODate
} from "@/lib/date-format";
import { cn } from "@/lib/utils";

type DateDisplayInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "type" | "value"> & {
  value: string;
  onChange: (value: string) => void;
};

type NativePickerInput = HTMLInputElement & {
  showPicker?: () => void;
};

function useDisplayValue(value: string, formatValue: (value: string) => string) {
  const [displayValue, setDisplayValue] = React.useState(() => formatValue(value));
  const [isEditing, setIsEditing] = React.useState(false);

  React.useEffect(() => {
    if (!isEditing) {
      setDisplayValue(formatValue(value));
    }
  }, [formatValue, isEditing, value]);

  return [displayValue, setDisplayValue, setIsEditing] as const;
}

export function DateDisplayInput({ value, onChange, onBlur, onFocus, className, ...props }: DateDisplayInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const pickerRef = React.useRef<NativePickerInput>(null);
  const formatValue = React.useCallback(formatDateDDMMYYYY, []);
  const [displayValue, setDisplayValue, setIsEditing] = useDisplayValue(value, formatValue);

  function updateValidity(nextValue: string) {
    const parsedValue = parseDDMMYYYYToISODate(nextValue);
    inputRef.current?.setCustomValidity(nextValue.trim() && !parsedValue ? "กรุณากรอกวันที่ในรูปแบบ dd/mm/yyyy" : "");
    return parsedValue;
  }

  function openPicker() {
    if (pickerRef.current?.showPicker) {
      pickerRef.current.showPicker();
      return;
    }

    pickerRef.current?.click();
    pickerRef.current?.focus();
  }

  return (
    <div className="relative">
      <Input
        {...props}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        placeholder={props.placeholder ?? "dd/mm/yyyy"}
        value={displayValue}
        className={cn("pr-12", className)}
        onChange={(event) => {
          const nextValue = event.target.value;
          setDisplayValue(nextValue);
          const parsedValue = updateValidity(nextValue);
          onChange(parsedValue ?? "");
        }}
        onFocus={(event) => {
          setIsEditing(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          const parsedValue = updateValidity(event.target.value);
          if (parsedValue) {
            setDisplayValue(formatValue(parsedValue));
          }
          setIsEditing(false);
          onBlur?.(event);
        }}
      />
      <input
        ref={pickerRef}
        type="date"
        value={value}
        onChange={(event) => {
          inputRef.current?.setCustomValidity("");
          onChange(event.target.value);
        }}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1/2 -translate-y-1/2"
        onClick={openPicker}
        aria-label="เลือกวันที่"
      >
        <CalendarDays className="size-4" />
      </Button>
    </div>
  );
}

export function DateTimeDisplayInput({ value, onChange, onBlur, onFocus, className, ...props }: DateDisplayInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const pickerRef = React.useRef<NativePickerInput>(null);
  const formatValue = React.useCallback(formatDateTimeDDMMYYYYHHmm, []);
  const [displayValue, setDisplayValue, setIsEditing] = useDisplayValue(value, formatValue);

  function updateValidity(nextValue: string) {
    const parsedValue = parseDDMMYYYYHHmmToLocalDateTime(nextValue);
    inputRef.current?.setCustomValidity(
      nextValue.trim() && !parsedValue ? "กรุณากรอกวันและเวลาในรูปแบบ dd/mm/yyyy hh:mm" : ""
    );
    return parsedValue;
  }

  function openPicker() {
    if (pickerRef.current?.showPicker) {
      pickerRef.current.showPicker();
      return;
    }

    pickerRef.current?.click();
    pickerRef.current?.focus();
  }

  return (
    <div className="relative">
      <Input
        {...props}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        placeholder={props.placeholder ?? "dd/mm/yyyy --:--"}
        value={displayValue}
        className={cn("pr-12", className)}
        onChange={(event) => {
          const nextValue = event.target.value;
          setDisplayValue(nextValue);
          const parsedValue = updateValidity(nextValue);
          onChange(parsedValue ?? "");
        }}
        onFocus={(event) => {
          setIsEditing(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          const parsedValue = updateValidity(event.target.value);
          if (parsedValue) {
            setDisplayValue(formatValue(parsedValue));
          }
          setIsEditing(false);
          onBlur?.(event);
        }}
      />
      <input
        ref={pickerRef}
        type="datetime-local"
        value={value}
        onChange={(event) => {
          inputRef.current?.setCustomValidity("");
          onChange(event.target.value);
        }}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1/2 -translate-y-1/2"
        onClick={openPicker}
        aria-label="เลือกวันและเวลา"
      >
        <CalendarDays className="size-4" />
      </Button>
    </div>
  );
}
