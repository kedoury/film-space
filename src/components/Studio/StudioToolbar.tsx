// 底部浮动工具栏（手机适配版）
// 编辑模式：旋转/添加/删除人形 + 升降/Joystick/Lock/Return
// 相机模式：焦段 + 摇杆/Lock/肩高/录制/Return
//
// 布局原则：
// - 底部左右分浮，不占满全宽，中间留空给画布
// - 按钮尺寸 44px+ 适配手机触摸
// - 模式切换按钮居中悬浮

import { useEffect, useRef } from "react";
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

// === 长按按钮 ===
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

// === 圆形玻璃按钮（44px 最小触摸尺寸） ===
function CircleButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`w-11 h-11 rounded-full glass-button flex items-center justify-center text-white ${className}`}
    >
      {children}
    </button>
  );
}

const ICON = "w-5 h-5";
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
  // edit 模式：移动轨道相机 target
  // camera 模式：移动虚拟相机位置（陀螺仪管旋转，摇杆管位置）
  const joystickRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const loop = setInterval(() => {
      const { x, y } = joystickRef.current;
      if (x === 0 && y === 0) return;
      if (!manager) return;
      if (mode === "edit") {
        manager.orbitController.moveHorizontally(x * 0.05);
        manager.orbitController.moveForward(-y * 0.05);
      } else if (mode === "camera") {
        manager.virtualController.moveHorizontal(x * 0.05);
        manager.virtualController.moveForward(-y * 0.05);
      }
    }, 16);
    return () => clearInterval(loop);
  }, [manager, mode]);

  const noSelection = !selectedHumanID;

  const handleEditLock = () => {
    if (!manager) return;
    manager.orbitController.lockEditPose();
    setLocked(true);
  };
  const handleEditReturn = () => {
    if (!manager) return;
    manager.orbitController.returnToLockedTransform();
  };
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
  const handleCameraReturn = () => {
    if (!manager) return;
    if (arActive) {
      manager.orbitController.pendingRecenter = true;
    } else {
      manager.virtualController.returnToLocked();
    }
  };
  const handleShoulderPlace = () => {
    if (!manager) return;
    manager.orbitController.pendingShoulderPlacement = true;
  };

  return (
    <>
      {/* === 左下角浮动按钮组 === */}
      <div className="absolute bottom-4 left-4 z-10 flex items-end gap-2 pointer-events-auto">
        {mode === "edit" ? (
          <>
            {/* 旋转 + 添加/删除 */}
            <div className="flex flex-col gap-2">
              <div className="flex gap-1.5">
                <HoldButton
                  onTick={() => rotateSelectedHuman(-0.03)}
                  disabled={noSelection}
                  className="w-11 h-11 rounded-full glass-button flex items-center justify-center text-white disabled:opacity-40"
                >
                  <RotateCcw className={ICON} />
                </HoldButton>
                <HoldButton
                  onTick={() => rotateSelectedHuman(0.03)}
                  disabled={noSelection}
                  className="w-11 h-11 rounded-full glass-button flex items-center justify-center text-white disabled:opacity-40"
                >
                  <RotateCw className={ICON} />
                </HoldButton>
              </div>
              <div className="flex gap-1.5">
                <CircleButton onClick={() => addHuman()} className="!w-9 !h-9">
                  <UserPlus className={ICON_SM} />
                </CircleButton>
                <CircleButton
                  onClick={() => deleteSelectedHuman()}
                  disabled={noSelection}
                  className="!w-9 !h-9 !text-status-rec"
                >
                  <Trash2 className={ICON_SM} />
                </CircleButton>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* 相机模式：摇杆（控制位移） */}
            <Joystick
              value={joystickRef.current}
              size={76}
              onChange={(v) => {
                joystickRef.current = v;
              }}
            />
            {/* 焦段 */}
            <button
              onClick={() => cycleFocalLength()}
              className="px-3 py-2 rounded-full glass-button text-white font-mono font-semibold flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition text-xs"
            >
              <Camera className={ICON_SM} />
              {focalLength}mm
            </button>
          </>
        )}
      </div>

      {/* === 右下角浮动按钮组 === */}
      <div className="absolute bottom-4 right-4 z-10 flex items-end gap-2 pointer-events-auto">
        {mode === "edit" ? (
          <>
            {/* 升降 */}
            <div className="flex flex-col gap-1.5">
              <HoldButton
                onTick={() => manager?.orbitController.moveVertically(0.03)}
                className="w-11 h-11 rounded-full glass-button flex items-center justify-center text-white"
              >
                <ArrowUp className={ICON} />
              </HoldButton>
              <HoldButton
                onTick={() => manager?.orbitController.moveVertically(-0.03)}
                className="w-11 h-11 rounded-full glass-button flex items-center justify-center text-white"
              >
                <ArrowDown className={ICON} />
              </HoldButton>
            </div>
            {/* Joystick */}
            <Joystick
              value={joystickRef.current}
              size={76}
              onChange={(v) => {
                joystickRef.current = v;
              }}
            />
            {/* Lock + Return */}
            <div className="flex flex-col gap-1.5">
              <CircleButton onClick={handleEditLock}>
                <Lock className={ICON} />
              </CircleButton>
              <CircleButton
                onClick={handleEditReturn}
                disabled={!locked}
                className="!text-accent-film"
              >
                <Undo2 className={ICON} />
              </CircleButton>
            </div>
          </>
        ) : (
          <>
            {/* 相机模式：肩高 + Lock + 录制 + Return */}
            <div className="flex flex-col gap-1.5">
              <CircleButton onClick={handleShoulderPlace}>
                <PersonStanding className={ICON} />
              </CircleButton>
              <CircleButton onClick={handleCameraLock}>
                <Lock className={ICON} />
              </CircleButton>
            </div>
            {/* 录制按钮 */}
            <button
              onClick={() => setRecording(!isRecording)}
              className="w-12 h-12 rounded-full glass-button flex items-center justify-center hover:brightness-110 active:scale-95 transition"
            >
              {isRecording ? (
                <div
                  className="rounded bg-status-rec"
                  style={{ width: 18, height: 18 }}
                />
              ) : (
                <div
                  className="rounded-full bg-status-rec"
                  style={{ width: 26, height: 26 }}
                />
              )}
            </button>
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

      {/* === 底部居中：模式切换 === */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-auto">
        <div className="flex items-center gap-0.5 p-0.5 rounded-full glass-panel shadow-glass">
          <button
            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 transition ${
              mode === "edit"
                ? "bg-white text-studio-black"
                : "text-studio-light"
            }`}
            onClick={() => setMode("edit")}
          >
            <Edit className="w-3 h-3" />
            编辑
          </button>
          <button
            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 transition ${
              mode === "camera"
                ? "bg-white text-studio-black"
                : "text-studio-light"
            }`}
            onClick={() => setMode("camera")}
          >
            <Camera className="w-3 h-3" />
            相机
          </button>
        </div>
      </div>
    </>
  );
}
