interface DefaultAvatarProps {
  size?: number;
  className?: string;
}

export function DefaultAvatar({ size = 40, className = '' }: DefaultAvatarProps) {
  const id = `da-${size}`;
  const radGradId = `radGrad-${id}`;
  const glowId = `glow-${id}`;
  const trailAnimId = `trailAnim-${id}`;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  const starScale = size / 40;
  const starR = 11 * starScale;
  const starInnerR = 4.8 * starScale;
  const starCx = cx;
  const starCy = cy;

  function starPoint(angle: number, radius: number): [number, number] {
    const a = (angle - 90) * (Math.PI / 180);
    return [starCx + radius * Math.cos(a), starCy + radius * Math.sin(a)];
  }

  const starPoints: string[] = [];
  for (let i = 0; i < 5; i++) {
    const outer = starPoint(i * 72, starR);
    const inner = starPoint(i * 72 + 36, starInnerR);
    starPoints.push(`${outer[0]},${outer[1]}`);
    starPoints.push(`${inner[0]},${inner[1]}`);
  }
  const starPointsStr = starPoints.join(' ');

  const fontSize = 12 * starScale;
  const letterSpacing = 0.6 * starScale;
  const strokeWidth = 1;

  const rPath = buildRPath(cx, cy, size);
  const sPath = buildSPath(cx, cy, size);
  const combinedPath = `${rPath} ${sPath}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={radGradId} cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#1a2a3a" />
          <stop offset="60%" stopColor="#0d1520" />
          <stop offset="100%" stopColor="#060d14" />
        </radialGradient>

        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={1.2 * starScale} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <style>{`
          @keyframes ${trailAnimId} {
            0%   { stroke-dashoffset: 200; opacity: 0; }
            10%  { opacity: 1; }
            80%  { opacity: 0.9; }
            100% { stroke-dashoffset: -200; opacity: 0; }
          }
        `}</style>
      </defs>

      <circle
        cx={cx}
        cy={cy}
        r={r - 0.5}
        fill={`url(#${radGradId})`}
        stroke="#00cfff"
        strokeWidth={Math.max(0.4, 0.6 * starScale)}
        strokeOpacity={0.25}
      />

      <polygon
        points={starPointsStr}
        fill="#00cfff"
        fillOpacity={0.07}
        stroke="#00cfff"
        strokeWidth={Math.max(0.5, 0.9 * starScale)}
        strokeOpacity={0.55}
        strokeLinejoin="round"
      />

      <text
        x={cx}
        y={cy + fontSize * 0.36}
        textAnchor="middle"
        fontFamily="Impact, 'Arial Narrow', Arial, sans-serif"
        fontStyle="italic"
        fontSize={fontSize}
        letterSpacing={letterSpacing}
        fill="none"
        stroke="#00cfff"
        strokeWidth={strokeWidth}
        strokeOpacity={0.9}
        filter={`url(#${glowId})`}
      >
        RS
      </text>

      <path
        d={combinedPath}
        fill="none"
        stroke="white"
        strokeWidth={Math.max(0.8, 1.5 * starScale)}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="18 200"
        strokeDashoffset={200}
        opacity={0}
        style={{
          animation: `${trailAnimId} 2.4s ease-in-out infinite`,
        }}
      />

      <path
        d={combinedPath}
        fill="none"
        stroke="#00cfff"
        strokeWidth={Math.max(0.4, 0.8 * starScale)}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="10 200"
        strokeDashoffset={210}
        opacity={0}
        style={{
          animation: `${trailAnimId} 2.4s ease-in-out infinite`,
          animationDelay: '0.12s',
        }}
      />
    </svg>
  );
}

function buildRPath(cx: number, cy: number, size: number): string {
  const sc = size / 40;
  const bx = cx - 5 * sc;
  const by = cy - 5 * sc;
  const h = 10 * sc;
  const bw = 3.5 * sc;
  const bumpR = 2.8 * sc;
  const bumpTopY = by + bumpR;
  const bumpBotY = by + bumpR * 2;
  const legEndX = bx + bw + bumpR + 2.2 * sc;
  const legEndY = by + h;

  return [
    `M ${bx} ${by + h}`,
    `L ${bx} ${by}`,
    `L ${bx + bw} ${by}`,
    `Q ${bx + bw + bumpR} ${by} ${bx + bw + bumpR} ${bumpTopY}`,
    `Q ${bx + bw + bumpR} ${bumpBotY} ${bx + bw} ${bumpBotY}`,
    `L ${bx} ${bumpBotY}`,
    `M ${bx + bw * 0.6} ${bumpBotY}`,
    `L ${legEndX} ${legEndY}`,
  ].join(' ');
}

function buildSPath(cx: number, cy: number, size: number): string {
  const sc = size / 40;
  const sx = cx + 1.5 * sc;
  const sy = cy - 5 * sc;
  const sw = 5 * sc;
  const sh = 10 * sc;
  const cr = 2.2 * sc;

  return [
    `M ${sx + sw} ${sy + cr}`,
    `Q ${sx + sw} ${sy} ${sx + sw - cr} ${sy}`,
    `L ${sx + cr} ${sy}`,
    `Q ${sx} ${sy} ${sx} ${sy + cr}`,
    `L ${sx} ${sy + sh / 2 - cr}`,
    `Q ${sx} ${sy + sh / 2} ${sx + cr} ${sy + sh / 2}`,
    `L ${sx + sw - cr} ${sy + sh / 2}`,
    `Q ${sx + sw} ${sy + sh / 2} ${sx + sw} ${sy + sh / 2 + cr}`,
    `L ${sx + sw} ${sy + sh - cr}`,
    `Q ${sx + sw} ${sy + sh} ${sx + sw - cr} ${sy + sh}`,
    `L ${sx + cr} ${sy + sh}`,
    `Q ${sx} ${sy + sh} ${sx} ${sy + sh - cr}`,
  ].join(' ');
}
