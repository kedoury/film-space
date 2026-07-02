// 工作台 3D 画布组件
// 管理 SceneManager 生命周期 + 手势/键盘交互
// 对应 iOS VirtualStudioView + ARCameraView 的视图层

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { MutableRefObject } from "react";
import { SceneManager } from "@/engine/SceneManager";
import { useStudioStore } from "@/store/sceneStore";

interface StudioCanvasProps {
  /** 外部传入的 manager 引用，由 StudioPage 创建并共享给 Toolbar */
  managerRef: MutableRefObject<SceneManager | null>;
  /** manager 初始化完成后触发，用于 StudioPage 更新 Context */
  onReady?: (manager: SceneManager) => void;
}

export function StudioCanvas({ managerRef, onReady }: StudioCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 手势状态
  const lastDragPos = useRef<{ x: number; y: number } | null>(null);
  const dragStartHumanPos = useRef<[number, number, number] | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const prevRecording = useRef(false);

  // 初始化引擎
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const manager = new SceneManager();
    managerRef.current = manager;

    manager.init(canvas);
    onReady?.(manager);

    manager.onTransformUpdate = (pose) => {
      useStudioStore.setState({
        cameraPose: {
          azimuth: pose.azimuth,
          elevation: pose.elevation,
          distance: pose.distance,
          target: pose.target,
        },
      });
    };
    manager.onRecordingProgress = (ms) => {
      useStudioStore.setState({ recordingMs: ms });
    };

    // 检测陀螺仪（DeviceOrientationEvent）支持
    const motionSupported =
      typeof window !== "undefined" && "DeviceOrientationEvent" in window;
    useStudioStore.setState({ arSupported: motionSupported });

    // ResizeObserver
    const ro = new ResizeObserver(() => {
      if (!canvasRef.current) return;
      const w = canvasRef.current.clientWidth;
      const h = canvasRef.current.clientHeight;
      manager.onResize(w, h);
    });
    ro.observe(canvas);

    // 键盘事件（Camera 模式 + 虚拟运镜时 WASD）
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // 键盘循环：相机模式下用 WASD 移动位置（陀螺仪管旋转，WASD 管位置）
    const keyLoop = setInterval(() => {
      if (!managerRef.current) return;
      const s = useStudioStore.getState();
      if (s.mode !== "camera") return;
      const keys = keysRef.current;
      const speed = 0.05;
      const vc = managerRef.current.virtualController;
      if (keys.has("w")) vc.moveForward(-speed);
      if (keys.has("s")) vc.moveForward(speed);
      if (keys.has("a")) vc.moveHorizontal(-speed);
      if (keys.has("d")) vc.moveHorizontal(speed);
      if (keys.has("q")) vc.moveVertical(-speed);
      if (keys.has("e")) vc.moveVertical(speed);
    }, 16);

    return () => {
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      clearInterval(keyLoop);
      manager.dispose();
      managerRef.current = null;
    };
  }, []);

  // 同步模式切换到引擎（edit ↔ camera，camera 模式自动尝试 AR）
  const mode = useStudioStore((s) => s.mode);
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;
    let cancelled = false;

    // 进入相机模式前锁定屏幕方向
    if (mode === "camera") {
      const orientation = useStudioStore.getState().cameraOrientation;
      try {
        const so = screen.orientation as unknown as {
          lock?: (o: string) => Promise<void>;
        };
        so.lock?.(orientation).catch(() => {
          // 锁定失败（如非 fullscreen / iOS Safari 不支持），忽略
        });
      } catch {
        // screen.orientation 不存在，忽略
      }
    } else {
      try {
        const so = screen.orientation as unknown as { unlock?: () => void };
        so.unlock?.();
      } catch {
        // 忽略
      }
    }

    manager
      .setMode(mode)
      .then(() => {
        if (!cancelled) {
          useStudioStore.getState().setARActive(manager.arActive);
        }
      })
      .catch((err) => {
        console.error("模式切换失败:", err);
        useStudioStore.getState().setARError(
          err instanceof Error ? err.message : String(err),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // 同步录制状态到引擎
  const isRecording = useStudioStore((s) => s.isRecording);
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;
    if (isRecording && !prevRecording.current) {
      useStudioStore.getState().setRecordingMs(0);
      manager.startRecording();
      prevRecording.current = true;
    } else if (!isRecording && prevRecording.current) {
      manager
        .stopRecording()
        .then((blob) => {
          useStudioStore.getState().setRecordingBlob(blob);
        })
        .catch((err) => console.error("停止录制失败:", err));
      prevRecording.current = false;
    }
  }, [isRecording]);

  // 同步 humans 到引擎
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;
    manager.syncHumans(
      useStudioStore.getState().humans,
      useStudioStore.getState().selectedHumanID,
    );
  });

  // 同步焦段
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;
    manager.setFocalLength(useStudioStore.getState().focalLength);
  });

  // 处理手势
  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    lastDragPos.current = { x: e.clientX, y: e.clientY };

    const s = useStudioStore.getState();
    if (s.mode === "edit" && s.selectedHumanID) {
      const human = s.humans.find((h) => h.id === s.selectedHumanID);
      if (human) {
        dragStartHumanPos.current = [...human.position];
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!lastDragPos.current || !managerRef.current) return;
    const manager = managerRef.current;
    const dx = e.clientX - lastDragPos.current.x;
    const dy = e.clientY - lastDragPos.current.y;
    lastDragPos.current = { x: e.clientX, y: e.clientY };

    const s = useStudioStore.getState();

    if (s.mode === "edit") {
      if (s.selectedHumanID && dragStartHumanPos.current) {
        // 移动选中人形（在地面平面上）
        const moveScale = manager.orbitController.distance * 0.0012;
        const az = manager.orbitController.azimuth;
        const right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
        const forward = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
        const offset = right.clone().multiplyScalar(dx * moveScale);
        offset.add(forward.clone().multiplyScalar(dy * moveScale));
        const newPos: [number, number, number] = [
          dragStartHumanPos.current[0] + offset.x,
          0,
          dragStartHumanPos.current[2] + offset.z,
        ];
        s.updateHumanPosition(s.selectedHumanID, newPos);
      } else {
        // 轨道旋转
        manager.orbitController.orbit(dx * 0.005, -dy * 0.005);
      }
    } else if (s.mode === "camera" && !s.arActive) {
      // 虚拟运镜（无陀螺仪）：鼠标拖动改变朝向
      manager.virtualController.lookDelta(-dx * 0.003, -dy * 0.003);
    }
    // 陀螺仪模式下，触摸拖动不改变朝向（设备旋转管朝向），位置移动由摇杆负责
  };

  const handlePointerUp = () => {
    lastDragPos.current = null;
    dragStartHumanPos.current = null;
  };

  // 滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    if (!managerRef.current) return;
    const s = useStudioStore.getState();
    if (s.mode !== "edit") return;
    const scale = e.deltaY > 0 ? 1.1 : 0.9;
    managerRef.current.orbitController.zoom(scale);
  };

  // 点击空白处取消选中
  const handleDoubleClick = () => {
    const s = useStudioStore.getState();
    if (s.mode === "edit") {
      s.selectHuman(null);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    />
  );
}
