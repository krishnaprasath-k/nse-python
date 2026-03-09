import React from "react";

export function CorporateEventsTimeline({ events, onEventClick }) {
  if (!events || events.length === 0) return null;

  return (
    <div className="w-full overflow-x-auto pb-4 pt-2 hide-scrollbar">
      <div className="flex gap-4 px-2 min-w-max">
        {events.map((evt, idx) => {
          let badgeColor = "bg-gray-100 text-gray-800";
          if (evt.type === "RESULT") badgeColor = "bg-blue-100 text-blue-800";
          if (evt.type === "DIVIDEND")
            badgeColor = "bg-purple-100 text-purple-800";
          if (evt.type === "SPLIT") badgeColor = "bg-pink-100 text-pink-800";
          if (evt.type === "BONUS") badgeColor = "bg-teal-100 text-teal-800";

          return (
            <div
              key={idx}
              onClick={() => onEventClick && onEventClick(evt.date)}
              className="flex-shrink-0 w-48 p-3 bg-white border rounded shadow-sm cursor-pointer hover:border-brand-primary hover:shadow-md transition-all"
            >
              <div className="flex justify-between items-start mb-2">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${badgeColor}`}
                >
                  {evt.type}
                </span>
                <span className="text-[12px] text-gray-500 font-medium">
                  {evt.date}
                </span>
              </div>
              <p
                className="text-[13px] font-semibold text-brand-primary truncate"
                title={evt.detail}
              >
                {evt.detail}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
