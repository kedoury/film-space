// 底部浮动工具栏
// 1:1 复刻 iOS StudioToolbar.swift 的功能
// 编辑模式：旋转/添加/删除人形 + 升降/Joystick/Lock/Return
// 相机模式：焦段 + 肩高/Lock/录制/Return

import { useEffect, useRef, useState } from "react";
import {
  RotateCcw,
  RotateCw,
  UserPlus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Lock,
  Undo2,
  PersonStanding,
  Camera,
  Edit,
} from "lucide-react";
import { useStudioStore } from "@/store/sceneStore";
import { useSceneManager } from "./StudioContext";
import { Joystick } from "./Joystick";

// === 长按按钮：pointerDown 持续触发 16ms 间隔 ===
function HoldButton({
  onTick,
  disabled,
  children,
  className,
}: {
  onTick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const timerRef = useRef<number | null>(null);

  const start = () => {
    if (disabled) return;
    onTick();
    timerRef.current = window.setInterval(onTick, 16);
  };
  const stop = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
  useEffect(() => () => stop(), []);

  return (
    <button
      className={className}
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
    >
      {children}
    </button>
  );
}

// === 圆形玻璃按钮 ===
function CircleButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`w-14 h-14 rounded-full glass-button flex items-center justify-center text-white ${className}`}
    >
      {children}
    </button>
  );
}

// === 图标尺寸常量 ===
const ICON = "w-[22px] h-[22px]";
const ICON_SM = "w-4 h-4";

export function StudioToolbar() {
  const mode = useStudioStore((s) => s.mode);
  const selectedHumanID = useStudioStore((s) => s.selectedHumanID);
  const focalLength = useStudioStore((s) => s.focalLength);
  const isRecording = useStudioStore((s) => s.isRecording);
  const locked = useStudioStore((s) => s.locked);
  const arActive = useStudioStore((s) => s.arActive);

  const setMode = useStudioStore((s) => s.setMode);
  const addHuman = useStudioStore((s) => s.addHuman);
  const deleteSelectedHuman = useStudioStore((s) => s.deleteSelectedHuman);
  const rotateSelectedHuman = useStudioStore((s) => s.rotateSelectedHuman);
  const cycleFocalLength = useStudioStore((s) => s.cycleFocalLength);
  const setRecording = useStudioStore((s) => s.setRecording);
  const setLocked = useStudioStore((s) => s.setLocked);

  const ctx = useSceneManager();
  const manager = ctx?.manager ?? null;

  // Joystick 连续移动循环
  const joystickRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const loop = setInterval(() => {
      const { x, y } = joystickRef.current;
      if (x === 0 && y === 0) return;
      if (!manager || mode !== "edit") return;
      manager.orbitController.moveHorizontally(x * 0.05);
      manager.orbitController.moveForward(-y * 0.05);
    }, 16);
    return () => clearInterval(loop);
  }, [manager, mode]);

  const noSelection = !selectedHumanID;

  // === 编辑模式 Lock ===
  const handleEditLock = () => {
    if (!manager) return;
    manager.orbitController.lockEditPose();
    setLocked(true);
  };
  // === 编辑模式 Return ===
  const handleEditReturn = () => {
    if (!manager) return;
    manager.orbitController.returnToLockedTransform();
  };
  // === 相机模式 Lock ===
  const handleCameraLock = () => {
    if (!manager) return;
    if (arActive) {
      manager.orbitController.lockedTransform =
        manager.orbitController.liveCameraTransform;
    } else {
      manager.orbitController.lockedTransform =
        manager.virtualController.lockCurrentPose();
    }
    setLocked(true);
  };
  // === 相机模式 Return ===
  const handleCameraReturn = () => {
    if (!manager) return;
    if (arActive) {
      manager.orbitController.pendingRecenter = true;
    } else {
      manager.virtualController.returnToLocked();
    }
  };
  // === 肩高放置 ===
  const handleShoulderPlace = () => {
    if (!manager) return;
    manager.orbitController.pendingShoulderPlacement = true;
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        {/* === 左组 === */}
        <div className="flex-1 flex items-center gap-3 pointer-events-auto">
          {mode === "edit" ? (
            <>
              {/* 旋转左/右 长按 */}
              <div className="flex gap-2">
                <HoldButton
                  onTick={() => rotateSelectedHuman(-0.03)}
                  disabled={noSelection}
                  className="w-14 h-14 rounded-full glass-button flex items-center justify-center text-white disabled:opacity-40"
                >
                  <RotateCcw className={ICON} />
                </HoldButton>
                <HoldButton
                  onTick={() => rotateSelectedHuman(0.03)}
                  disabled={noSelection}
                  className="w-14 h-14 rounded-full glass-button flex items-center justify-center text-white disabled:opacity-40"
                >
                  <RotateCw className={ICON} />
                </HoldButton>
              </div>
              {/* 添加 / 删除（垂直堆叠） */}
              <div className="flex flex-col gap-1">
                <CircleButton onClick={() => addHuman()} className="!w-10 !h-10">
                  <UserPlus className={ICON_SM} />
                </CircleButton>
                <CircleButton
                  onClick={() => deleteSelectedHuman()}
                  disabled={noSelection}
                  className="!w-10 !h-10 !text-status-rec"
                >
                  <Trash2 className={ICON_SM} />
                </CircleButton>
              </div>
            </>
          ) : (
            <>
              {/* 焦段按钮 */}
              <button
                onClick={() => cycleFocalLength()}
                className="px-5 py-2.5 rounded-full glass-button text-white font-mono font-semibold flex items-center gap-2 hover:brightness-110 active:scale-95 transition"
              >
                <Camera className={ICON_SM} />
                {focalLength}mm
              </button>
            </>
          )}
        </div>

        {/* === 中间：模式切换 === */}
        <div className="flex items-center gap-1 p-1 rounded-full glass-panel pointer-events-auto shadow-glass">
          <button
            className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5 transition ${
              mode === "edit"
                ? "bg-white text-studio-black"
                : "text-studio-light"
            }`}
            onClick={() => setMode("edit")}
          >
            <Edit className={ICON_SM} />
            编辑
          </button>
          <button
            className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5 transition ${
              mode === "camera"
                ? "bg-white text-studio-black"
                : "text-studio-light"
            }`}
            onClick={() => setMode("camera")}
          >
            <Camera className={ICON_SM} />
            相机
          </button>
        </div>

        {/* === 右组 === */}
        <div className="flex-1 flex items-center justify-end gap-3 pointer-events-auto">
          {mode === "edit" ? (
            <>
              {/* 升降 */}
              <div className="flex gap-2">
                <HoldButton
                  onTick={() =>
                    manager?.orbitController.moveVertically(0.03)
                  }
                  className="w-14 h-14 rounded-full glass-button flex items-center justify-center text-white"
                >
                  <ArrowUp className={ICON} />
                </HoldButton>
                <HoldButton
                  onTick={() =>
                    manager?.orbitController.moveVertically(-0.03)
                  }
                  className="w-14 h-14 rounded-full glass-button flex items-center justify-center text-white"
                >
                  <ArrowDown className={ICON} />
                </HoldButton>
              </div>
              {/* Joystick */}
              <Joystick
                value={joystickRef.current}
                size={88}
                onChange={(v) => {
                  joystickRef.current = v;
                }}
              />
              {/* Lock */}
              <CircleButton onClick={handleEditLock}>
                <Lock className={ICON} />
              </CircleButton>
              {/* Return */}
              <CircleButton
                onClick={handleEditReturn}
                disabled={!locked}
                className="!text-accent-film"
              >
                <Undo2 className={ICON} />
              </CircleButton>
            </>
          ) : (
            <>
              {/* 肩高放置 */}
              <CircleButton onClick={handleShoulderPlace}>
                <PersonStanding className={ICON} />
              </CircleButton>
              {/* Lock */}
              <CircleButton onClick={handleCameraLock}>
                <Lock className={ICON} />
              </CircleButton>
              {/* 录制按钮 */}
              <button
                onClick={() => setRecording(!isRecording)}
                className="w-14 h-14 rounded-full glass-button flex items-center justify-center hover:brightness-110 active:scale-95 transition"
              >
                {isRecording ? (
                  <div
                    className="rounded bg-status-rec"
                    style={{ width: 22, height: 22 }}
                  />
                ) : (
                  <div
                    className="rounded-full bg-status-rec"
                    style={{ width: 30, height: 30 }}
                  />
                )}
              </button>
              {/* Return */}
              <CircleButton
                onClick={handleCameraReturn}
                disabled={!locked}
                className="!text-accent-film"
              >
                <Undo2 className={ICON} />
              </CircleButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
