// 工作台主页面
// 全屏 ZStack：StudioCanvas + RecordingBar + ARPrompt + StudioToolbar + RecordingResultDialog
// 顶部左侧导航：返回首页 + 场景库/视频库
// 用 StudioContext.Provider 包裹，manager 通过 onReady 回调暴露给子组件

import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Folder, Film, RectangleHorizontal, RectangleVertical } from "lucide-react";
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
  const cameraOrientation = useStudioStore((s) => s.cameraOrientation);
  const setARActive = useStudioStore((s) => s.setARActive);
  const setCameraOrientation = useStudioStore((s) => s.setCameraOrientation);

  const showARPrompt =
    arSupported === true &&
    !arActive &&
    mode === "camera" &&
    !arPromptDismissed;

  const handleAREnter = async () => {
    const m = managerRef.current;
    if (!m) return;
    try {
      await m.setMode("edit");
      await m.setMode("camera");
      setARActive(m.arActive);
    } catch (err) {
      console.error("陀螺仪启用失败:", err);
    }
  };

  const ctxValue: StudioContextValue = { manager };

  return (
    <StudioContext.Provider value={ctxValue}>
      <div className="fixed inset-0 bg-studio-black overflow-hidden">
        {/* 3D 画布 */}
        <StudioCanvas managerRef={managerRef} onReady={setManager} />

        {/* 顶部状态条（居中浮动，不遮挡） */}
        <RecordingBar />

        {/* 左上角：返回 + 场景库/视频库（紧凑） */}
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5">
          <Link
            to="/"
            className="w-8 h-8 rounded-full glass-panel flex items-center justify-center text-white hover:brightness-110 active:scale-95 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <Link
            to="/scenes"
            className="w-8 h-8 rounded-full glass-panel flex items-center justify-center text-white hover:brightness-110 active:scale-95 transition"
            title="场景库"
          >
            <Folder className="w-4 h-4" />
          </Link>
          <Link
            to="/videos"
            className="w-8 h-8 rounded-full glass-panel flex items-center justify-center text-white hover:brightness-110 active:scale-95 transition"
            title="视频库"
          >
            <Film className="w-4 h-4" />
          </Link>
        </div>

        {/* 右上角：横竖屏切换（紧凑） */}
        <div className="absolute top-2 right-2 z-20 flex items-center gap-0.5 p-0.5 rounded-full glass-panel">
          <button
            onClick={() => setCameraOrientation("landscape")}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
              cameraOrientation === "landscape"
                ? "bg-white text-studio-black"
                : "text-studio-light"
            }`}
            title="横屏运镜"
          >
            <RectangleHorizontal className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCameraOrientation("portrait")}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
              cameraOrientation === "portrait"
                ? "bg-white text-studio-black"
                : "text-studio-light"
            }`}
            title="竖屏运镜"
          >
            <RectangleVertical className="w-4 h-4" />
          </button>
        </div>

        {/* 陀螺仪入口提示 */}
        {showARPrompt && (
          <ARPrompt
            onEnter={handleAREnter}
            onDismiss={() => setArPromptDismissed(true)}
          />
        )}

        {/* 底部浮动工具栏 */}
        <StudioToolbar />

        {/* 录制结果弹窗 */}
        {recordingBlob !== null && <RecordingResultDialog />}
      </div>
    </StudioContext.Provider>
  );
}
