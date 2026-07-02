// 顶部录制状态条（紧凑版，不遮挡画布）
// 只在需要时显示：模式徽章始终显示，录制时长仅录制时显示

import { Circle, Camera, Edit } from "lucide-react";
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
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none flex items-center gap-2">
      {/* 模式徽章 */}
      <div
        className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold flex items-center gap-1 glass-panel ${
          mode === "edit"
            ? "text-studio-light"
            : "text-accent-film"
        }`}
      >
        {mode === "edit" ? (
          <Edit className="w-2.5 h-2.5" />
        ) : (
          <Camera className="w-2.5 h-2.5" />
        )}
        {mode === "edit" ? "EDIT" : arActive ? "GYRO" : "CAM"}
      </div>

      {/* 录制时长（仅录制时显示） */}
      {isRecording && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-status-rec/20 glass-panel">
          <Circle className="w-2 h-2 fill-status-rec text-status-rec animate-rec-pulse" />
          <span className="font-mono text-[10px] text-white tabular-nums">
            {formatTime(recordingMs)}
          </span>
        </div>
      )}
    </div>
  );
}
