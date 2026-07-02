// 顶部录制状态条
// 显示模式徽章、录制时长、FPS

import { Circle, Camera, Edit, Video } from "lucide-react";
import { useStudioStore } from "@/store/sceneStore";

function formatTime(ms: number): string {
  const totalSec = ms / 1000;
  const sec = Math.floor(totalSec);
  const tenth = Math.floor((totalSec - sec) * 10);
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${tenth}`;
}

export function RecordingBar() {
  const mode = useStudioStore((s) => s.mode);
  const isRecording = useStudioStore((s) => s.isRecording);
  const recordingMs = useStudioStore((s) => s.recordingMs);
  const arActive = useStudioStore((s) => s.arActive);

  return (
    <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
      <div className="flex items-center justify-between px-6 py-3">
        {/* 左：模式徽章 */}
        <div className="flex items-center gap-2">
          <div
            className={`px-3 py-1 rounded-full text-xs font-mono font-semibold flex items-center gap-1.5 ${
              mode === "edit"
                ? "bg-studio-panel/80 text-studio-light"
                : "bg-accent-film/20 text-accent-film"
            }`}
          >
            {mode === "edit" ? (
              <Edit className="w-3 h-3" />
            ) : (
              <Camera className="w-3 h-3" />
            )}
            {mode === "edit" ? "EDIT" : arActive ? "AR" : "CAM"}
          </div>
        </div>

        {/* 中：录制时长 */}
        {isRecording && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-status-rec/20">
            <Circle className="w-2.5 h-2.5 fill-status-rec text-status-rec animate-rec-pulse" />
            <span className="font-mono text-sm text-white tabular-nums">
              {formatTime(recordingMs)}
            </span>
          </div>
        )}

        {/* 右：录制占位（保持对称） */}
        <div className="w-20 flex justify-end">
          {isRecording && (
            <Video className="w-4 h-4 text-status-rec/60" />
          )}
        </div>
      </div>
    </div>
  );
}
