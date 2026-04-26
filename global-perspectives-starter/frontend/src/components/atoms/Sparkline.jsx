// Sparkline — inline SVG mini-chart for time-series snapshots.
// Renders nothing if fewer than 2 valid data points.
//
// Props:
//   data:   array of numbers OR objects (use accessor)
//   accessor: (d) => number   default: identity
//   width / height: pixels    defaults: 60 / 20
//   color:  stroke color      default: --accent
//   strokeWidth: number       default: 1.5

export default function Sparkline({
  data,
  accessor = (d) => (typeof d === 'number' ? d : d?.value),
  width = 60,
  height = 20,
  color = 'var(--accent, #a2442e)',
  strokeWidth = 1.5,
}) {
  if (!Array.isArray(data) || data.length < 2) return null;
  const values = data.map(accessor).filter(v => v != null && !Number.isNaN(v));
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg
      width={width}
      height={height}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
      role="img"
      aria-label={`Trend from ${values[0]} to ${values[values.length - 1]}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Convenience wrapper for the common riskScore-history pattern
export function RiskSparkline({ snapshots, color, ...rest }) {
  return (
    <Sparkline
      data={snapshots}
      accessor={(s) => s?.riskScore ?? null}
      color={color}
      {...rest}
    />
  );
}
