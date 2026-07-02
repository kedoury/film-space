// 工作台主页面
// 全屏 ZStack：StudioCanvas + RecordingBar + ARPrompt + StudioToolbar + RecordingResultDialog
// 顶部左侧导航：返回首页 + 场景库/视频库
// 用 StudioContext.Provider 包裹，manager 通过 onReady 回调暴露给子组件

import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Folder, Film } from "lucide-react";
import type { SceneManager } from "@/engine/SceneManager";
import { StudioCanvas } from "@/components/Studio/StudioCanvas";
import { RecordingBar } from "@/components/Studio/RecordingBar";
import { ARPrompt } from "@/components/Studio/ARPrompt";
import { StudioToolbar } from "@/components/Studio/StudioToolbar";
import { RecordingResultDialog } from "@/components/Studio/RecordingResultDialog";
import { StudioContext } from "@/components/Studio/StudioContext";
import type { StudioContextValue } from "@/components/Studio/StudioContext";
import { useStudioStore } from "@/store/sceneStore";

export function StudioPage() {
  const managerRef = useRef<SceneManager | null>(null);
  const [manager, setManager] = useState<SceneManager | null>(null);
  const [arPromptDismissed, setArPromptDismissed] = useState(false);

  const mode = useStudioStore((s) => s.mode);
  const arSupported = useStudioStore((s) => s.arSupported);
  const arActive = useStudioStore((s) => s.arActive);
  const recordingBlob = useStudioStore((s) => s.recordingBlob);
  const setARActive = useStudioStore((s) => s.setARActive);

  const showARPrompt =
    arSupported === true &&
    !arActive &&
    mode === "camera" &&
    !arPromptDismissed;

  // AR 重试：切回 edit 再切回 camera 触发 AR 重新入会
  const handleAREnter = async () => {
    const m = managerRef.current;
    if (!m) return;
    try {
      await m.setMode("edit");
      await m.setMode("camera");
      setARActive(m.arActive);
    } catch (err) {
      console.error("AR 入会失败:", err);
    }
  };

  const ctxValue: StudioContextValue = { manager };

  return (
    <StudioContext.Provider value={ctxValue}>
      <div className="fixed inset-0 bg-studio-black overflow-hidden">
        {/* 3D 画布 */}
        <StudioCanvas managerRef={managerRef} onReady={setManager} />

        {/* 顶部录制状态条 */}
        <RecordingBar />

        {/* 顶部左侧导航 */}
        <div className="absolute top-3 left-4 z-20 flex items-center gap-3">
          <Link
            to="/"
            className="w-9 h-9 rounded-full glass-panel flex items-center justify-center text-white hover:brightness-110 active:scale-95 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-1">
            <Link
              to="/scenes"
              className="px-3 py-1.5 rounded-full glass-panel text-sm text-white flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition"
            >
              <Folder className="w-4 h-4" />
              场景库
            </Link>
            <Link
              to="/videos"
              className="px-3 py-1.5 rounded-full glass-panel text-sm text-white flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition"
            >
              <Film className="w-4 h-4" />
              视频库
            </Link>
          </div>
        </div>

        {/* AR 入口提示 */}
        {showARPrompt && (
          <ARPrompt
            onEnter={handleAREnter}
            onDismiss={() => setArPromptDismissed(true)}
          />
        )}

        {/* 底部工具栏 */}
        <StudioToolbar />

        {/* 录制结果弹窗 */}
        {recordingBlob !== null && <RecordingResultDialog />}
      </div>
    </StudioContext.Provider>
  );
}
