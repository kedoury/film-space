// 陀螺仪运镜入口提示卡片

import { Smartphone, X } from "lucide-react";

interface ARPromptProps {
  onEnter: () => void;
  onDismiss: () => void;
}

export function ARPrompt({ onEnter, onDismiss }: ARPromptProps) {
  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 animate-slide-down">
      <div className="glass-panel rounded-2xl px-4 py-3 shadow-glass flex items-center gap-3 max-w-[90vw]">
        <div className="w-8 h-8 rounded-full bg-accent-film/20 flex items-center justify-center flex-shrink-0">
          <Smartphone className="w-4 h-4 text-accent-film" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-white">检测到陀螺仪</div>
          <div className="text-[10px] text-studio-light mt-0.5">
            转动手机改变方向，摇杆控制走位
          </div>
        </div>
        <button
          onClick={onEnter}
          className="px-3 py-1.5 rounded-lg bg-accent-film text-studio-black text-xs font-semibold hover:brightness-110 active:scale-95 transition"
        >
          启用
        </button>
        <button
          onClick={onDismiss}
          className="w-7 h-7 rounded-full flex items-center justify-center text-studio-light hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
