// AR 模式入口提示卡片
// 检测到 WebXR AR 支持时从顶部下滑出现

import { Smartphone, X } from "lucide-react";

interface ARPromptProps {
  onEnter: () => void;
  onDismiss: () => void;
}

export function ARPrompt({ onEnter, onDismiss }: ARPromptProps) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 animate-slide-down">
      <div className="glass-panel rounded-2xl px-5 py-4 shadow-glass flex items-center gap-4 max-w-md">
        <div className="w-10 h-10 rounded-full bg-accent-film/20 flex items-center justify-center flex-shrink-0">
          <Smartphone className="w-5 h-5 text-accent-film" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">检测到 AR 支持</div>
          <div className="text-xs text-studio-light mt-0.5">
            举着手机走动即可运镜，与 iOS 版体验一致
          </div>
        </div>
        <button
          onClick={onEnter}
          className="px-4 py-2 rounded-lg bg-accent-film text-studio-black text-sm font-semibold hover:brightness-110 active:scale-95 transition"
        >
          进入 AR
        </button>
        <button
          onClick={onDismiss}
          className="w-8 h-8 rounded-full flex items-center justify-center text-studio-light hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
