import { DOOR_X, DOOR_Y, ROOM_H, ROOM_W } from './roomConstants'

/** Static illustrated room — warm, calm, not overcrowded */
export function RoomBackdrop() {
  return (
    <svg
      width={ROOM_W}
      height={ROOM_H}
      viewBox={`0 0 ${ROOM_W} ${ROOM_H}`}
      className="pointer-events-none select-none"
      aria-hidden
    >
      <defs>
        <linearGradient id="wallGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EDE4D8" />
          <stop offset="100%" stopColor="#E2D5C4" />
        </linearGradient>
        <linearGradient id="floorGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#C4A882" />
          <stop offset="100%" stopColor="#B8956E" />
        </linearGradient>
        <pattern id="planks" width="120" height="24" patternUnits="userSpaceOnUse">
          <rect width="120" height="24" fill="#B8956E" />
          <line x1="0" y1="23" x2="120" y2="23" stroke="#A88462" strokeWidth="1" />
        </pattern>
      </defs>

      {/* Back wall */}
      <rect x="0" y="0" width={ROOM_W} height={ROOM_H * 0.62} fill="url(#wallGrad)" />
      {/* Floor */}
      <rect
        x="0"
        y={ROOM_H * 0.62}
        width={ROOM_W}
        height={ROOM_H * 0.38}
        fill="url(#planks)"
      />

      {/* Window left */}
      <g transform={`translate(180, ${ROOM_H * 0.18})`}>
        <rect x="0" y="0" width="220" height="280" rx="4" fill="#D9CFC0" stroke="#C4B5A0" strokeWidth="6" />
        <rect x="12" y="12" width="196" height="256" fill="#C5E4F5" opacity="0.85" />
        <line x1="110" y1="12" x2="110" y2="268" stroke="#C4B5A0" strokeWidth="4" />
        <line x1="12" y1="140" x2="208" y2="140" stroke="#C4B5A0" strokeWidth="4" />
        <path
          d="M 20 260 Q 110 200 200 260"
          fill="none"
          stroke="rgba(255,220,150,0.5)"
          strokeWidth="40"
          opacity="0.4"
        />
      </g>

      {/* Bookshelf */}
      <g transform={`translate(${ROOM_W * 0.12}, ${ROOM_H * 0.28})`}>
        <rect x="0" y="0" width="140" height="320" fill="#8B6914" rx="2" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x="8" y={20 + i * 72} width="124" height="8" fill="#6B4F10" />
        ))}
        {['#9B6B7A', '#5C6B5A', '#6B7B8C', '#C4A882'].map((c, i) => (
          <rect
            key={c}
            x={12 + (i % 2) * 58}
            y={28 + Math.floor(i / 2) * 72}
            width="48"
            height="56"
            fill={c}
            rx="1"
          />
        ))}
      </g>

      {/* Sofa */}
      <g transform={`translate(${ROOM_W * 0.38}, ${ROOM_H * 0.48})`}>
        <rect x="0" y="40" width="320" height="100" rx="16" fill="#9B8B7A" />
        <rect x="-20" y="20" width="40" height="120" rx="12" fill="#8B7B6A" />
        <rect x="300" y="20" width="40" height="120" rx="12" fill="#8B7B6A" />
        <rect x="0" y="0" width="320" height="60" rx="14" fill="#A89888" />
      </g>

      {/* Rug */}
      <ellipse
        cx={ROOM_W * 0.48}
        cy={ROOM_H * 0.72}
        rx="380"
        ry="120"
        fill="#D4C4B0"
        opacity="0.65"
      />

      {/* Plant */}
      <g transform={`translate(${ROOM_W * 0.72}, ${ROOM_H * 0.42})`}>
        <rect x="20" y="100" width="36" height="48" rx="4" fill="#C68642" />
        <ellipse cx="38" cy="80" rx="50" ry="70" fill="#4A6741" opacity="0.9" />
        <ellipse cx="20" cy="95" rx="28" ry="40" fill="#5C7A52" />
      </g>

      {/* Lamp */}
      <g transform={`translate(${ROOM_W * 0.58}, ${ROOM_H * 0.35})`}>
        <rect x="18" y="60" width="8" height="100" fill="#5C4033" />
        <path d="M 0 60 L 44 60 L 36 20 L 8 20 Z" fill="#F5E6C8" opacity="0.95" />
        <ellipse cx="22" cy="100" rx="60" ry="30" fill="rgba(255,230,180,0.15)" />
      </g>

      {/* Painting */}
      <g transform={`translate(${ROOM_W * 0.62}, ${ROOM_H * 0.12})`}>
        <rect x="0" y="0" width="160" height="120" fill="#FAF7F2" stroke="#C4B5A0" strokeWidth="8" />
        <circle cx="80" cy="55" r="28" fill="#E8B4A0" opacity="0.6" />
        <rect x="30" y="85" width="100" height="20" fill="#8B7355" opacity="0.4" />
      </g>

      {/* Door */}
      <g transform={`translate(${DOOR_X - 60}, ${DOOR_Y - 160})`}>
        <rect x="0" y="0" width="120" height="220" fill="#7A5C44" rx="4" />
        <rect x="8" y="8" width="104" height="204" fill="#8B6914" rx="2" />
        <circle cx="98" cy="110" r="6" fill="#D4C4B0" />
        <path
          id="room-door-panel"
          d="M 8 8 L 112 8 L 112 212 L 8 212 Z"
          fill="none"
          stroke="#6B4F10"
          strokeWidth="2"
        />
      </g>
    </svg>
  )
}
