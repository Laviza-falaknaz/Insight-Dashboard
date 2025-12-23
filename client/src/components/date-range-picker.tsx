import { useState } from "react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface DateRangePickerProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  className?: string;
}

const presets = [
  { label: "Today", value: "today" },
  { label: "Last 7 Days", value: "7days" },
  { label: "Last 30 Days", value: "30days" },
  { label: "This Month", value: "thisMonth" },
  { label: "Last Month", value: "lastMonth" },
  { label: "Last 3 Months", value: "3months" },
  { label: "Last 6 Months", value: "6months" },
  { label: "Year to Date", value: "ytd" },
  { label: "Last Year", value: "lastYear" },
  { label: "All Time", value: "all" },
];

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handlePresetChange = (value: string) => {
    const today = new Date();
    let from: Date | undefined;
    let to: Date | undefined = today;

    switch (value) {
      case "today":
        from = today;
        break;
      case "7days":
        from = subDays(today, 7);
        break;
      case "30days":
        from = subDays(today, 30);
        break;
      case "thisMonth":
        from = startOfMonth(today);
        to = endOfMonth(today);
        break;
      case "lastMonth":
        from = startOfMonth(subMonths(today, 1));
        to = endOfMonth(subMonths(today, 1));
        break;
      case "3months":
        from = subMonths(today, 3);
        break;
      case "6months":
        from = subMonths(today, 6);
        break;
      case "ytd":
        from = startOfYear(today);
        break;
      case "lastYear":
        from = subMonths(today, 12);
        break;
      case "all":
        from = undefined;
        to = undefined;
        break;
    }

    onDateRangeChange({ from, to });
  };

  const formatDateRange = () => {
    if (!dateRange.from && !dateRange.to) {
      return "All Time";
    }
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}`;
    }
    if (dateRange.from) {
      return `From ${format(dateRange.from, "MMM d, yyyy")}`;
    }
    return "Select date range";
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[140px]" data-testid="select-date-preset">
          <SelectValue placeholder="Quick Select" />
        </SelectTrigger>
        <SelectContent>
          {presets.map((preset) => (
            <SelectItem key={preset.value} value={preset.value}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal min-w-[240px]",
              !dateRange.from && "text-muted-foreground"
            )}
            data-testid="button-date-range"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatDateRange()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange.from}
            selected={{ from: dateRange.from, to: dateRange.to }}
            onSelect={(range) => {
              onDateRangeChange({ from: range?.from, to: range?.to });
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
