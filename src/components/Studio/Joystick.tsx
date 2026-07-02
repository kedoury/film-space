// 虚拟摇杆组件：返回归一化向量 (-1..1)
// 对应 iOS 版 StudioToolbar 里的 Joystick

import { useRef, useState } from "react";

interface JoystickProps {
  value: { x: number; y: number };
  onChange: (value: { x: number; y: number }) => void;
  size?: number;
}

export function Joystick({ value, onChange, size = 104 }: JoystickProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const thumbSize = size * 0.42;
  const maxRadius = (size - thumbSize) / 2;
  const active = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    active.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!active.current) return;
    let dx = e.movementX;
    let dy = e.movementY;
    // 用累积位移（pointer capture 下 movement 是增量）
    const newOffset = { x: offset.x + dx, y: offset.y + dy };
    const dist = Math.hypot(newOffset.x, newOffset.y);
    if (dist > maxRadius && dist > 0) {
      const scale = maxRadius / dist;
      newOffset.x *= scale;
      newOffset.y *= scale;
    }
    setOffset(newOffset);
    onChange({
      x: newOffset.x / maxRadius,
      y: newOffset.y / maxRadius,
    });
  };

  const handlePointerUp = () => {
    active.current = false;
    setOffset({ x: 0, y: 0 });
    onChange({ x: 0, y: 0 });
  };

  return (
    <div
      className="relative rounded-full glass-panel shadow-glass flex items-center justify-center touch-none"
      style={{ width: size, height: size }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className="absolute rounded-full bg-white shadow-float"
        style={{
          width: thumbSize,
          height: thumbSize,
          transform: `translate(${offset.x}px, ${offset.y}px)`,
          transition: active.current ? "none" : "transform 0.2s ease-out",
        }}
      />
      {/* 中心十字辅助线 */}
      <div className="absolute w-px h-4 bg-studio-muted/30" />
      <div className="absolute h-px w-4 bg-studio-muted/30" />
    </div>
  );
}
