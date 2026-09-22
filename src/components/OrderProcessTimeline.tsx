import React from "react";
import { Check } from "lucide-react";
import type { OrderStatus } from "@/types";

interface TimelineStage {
  id: string;
  label: string;
  shortLabel: string;
}

const TIMELINE_STAGES: TimelineStage[] = [
  { id: "Received", label: "Collect from Customer", shortLabel: "1. Collect" },
  { id: "Processing", label: "Wash / Dry Clean", shortLabel: "2. Wash" },
  { id: "Ironing", label: "Ironing & Pressing", shortLabel: "3. Ironing" },
  { id: "Ready", label: "Shop Collection / Delivery", shortLabel: "4. Ready" },
  { id: "Collected", label: "Payment Settled & Delivered", shortLabel: "5. Delivered" },
];

function getStageIndex(status: string): number {
  switch (status) {
    case "Received":
      return 0;
    case "Processing":
    case "Washing":
      return 1;
    case "Ironing":
      return 2;
    case "Ready":
      return 3;
    case "Collected":
      return 4;
    default:
      return 0;
  }
}

function formatTimeOnly(isoString?: string): string | null {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }).format(d);
  } catch {
    return null;
  }
}

export function OrderProcessTimeline({
  status,
  createdAt,
  updatedAt,
  className = "",
}: {
  status: OrderStatus | string;
  createdAt?: string;
  updatedAt?: string;
  className?: string;
}) {
  const currentIdx = getStageIndex(status);
  const isCollected = status === "Collected";
  const createdTimeStr = formatTimeOnly(createdAt);
  const updatedTimeStr = formatTimeOnly(updatedAt);

  return (
    <div
      className={`bg-slate-50/80 border border-slate-200/80 rounded-xl p-2 sm:p-3 select-none w-full max-w-full overflow-hidden ${className}`}
      aria-label="Order progress timeline"
    >
      <div className="relative flex items-start justify-between w-full">
        {/* Continuous Connecting Line Behind Nodes */}
        <div className="absolute top-2.5 sm:top-3 left-3 right-3 sm:left-4 sm:right-4 h-0.5 bg-slate-200 -z-0">
          <div
            className="h-full bg-emerald-600 transition-all duration-300 ease-in-out"
            style={{
              width: `${(Math.min(currentIdx, 4) / 4) * 100}%`,
            }}
          />
        </div>

        {/* 5 Sequential Nodes */}
        {TIMELINE_STAGES.map((stage, idx) => {
          const isCompleted = isCollected ? true : idx < currentIdx;
          const isCurrent = !isCollected && idx === currentIdx;
          const isUpcoming = !isCollected && idx > currentIdx;

          // Timestamp logic without customer confusion
          let timeSubtitle: string | null = null;
          if (idx === 0 && createdTimeStr) {
            timeSubtitle = createdTimeStr;
          } else if (isCurrent) {
            timeSubtitle = "In progress";
          } else if (isCompleted && idx === currentIdx && updatedTimeStr) {
            timeSubtitle = updatedTimeStr;
          }

          return (
            <div
              key={stage.id}
              className="relative z-10 flex flex-col items-center text-center flex-1 min-w-0 px-0.5"
            >
              {/* Circle Indicator */}
              <div
                className={`size-4.5 sm:size-6 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                  isCompleted
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : isCurrent
                    ? "bg-[#0F4C5C] text-white ring-2 sm:ring-3 ring-[#0F4C5C]/20 shadow-xs scale-105"
                    : "border-2 border-slate-300 bg-white text-slate-300"
                }`}
                title={`${stage.label}: ${isCompleted ? "Completed" : isCurrent ? "Currently in progress" : "Upcoming"}`}
              >
                {isCompleted ? (
                  <Check className="size-2.5 sm:size-3.5 stroke-[3]" />
                ) : isCurrent ? (
                  <span className="size-1 sm:size-2 rounded-full bg-white animate-pulse" />
                ) : (
                  <span className="size-1 rounded-full bg-slate-300" />
                )}
              </div>

              {/* Stage Label */}
              <span
                className={`text-[8.5px] sm:text-[10px] mt-1 sm:mt-1.5 leading-tight truncate w-full max-w-[56px] sm:max-w-none ${
                  isCurrent
                    ? "font-extrabold text-[#0F4C5C]"
                    : isCompleted
                    ? "font-bold text-slate-800"
                    : "font-medium text-slate-400"
                }`}
              >
                {stage.shortLabel}
              </span>

              {/* Subtitle / Timestamp */}
              <span
                className={`text-[7.5px] sm:text-[8px] leading-none mt-0.5 truncate w-full max-w-[50px] sm:max-w-none ${
                  isCurrent
                    ? "text-[#0F4C5C] font-bold"
                    : isCompleted
                    ? "text-slate-500 font-medium"
                    : "text-slate-300"
                }`}
              >
                {timeSubtitle || (isUpcoming ? "—" : "✓")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default OrderProcessTimeline;
