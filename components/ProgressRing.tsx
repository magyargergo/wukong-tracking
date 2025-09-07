import React from "react";

export function ProgressRing({ value, size=64, strokeWidth=8 }: { value: number; size?: number; strokeWidth?: number; }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} className="block">
      <circle
        stroke="#262626"
        fill="transparent"
        strokeWidth={strokeWidth}
        r={radius}
        cx={size/2}
        cy={size/2}
      />
      <circle
        stroke="currentColor"
        className="text-accent"
        fill="transparent"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        r={radius}
        cx={size/2}
        cy={size/2}
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize={size*0.28}
        className="fill-neutral-200"
      >
        {Math.round(value)}%
      </text>
    </svg>
  );
}


