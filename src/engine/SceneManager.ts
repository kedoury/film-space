// 引擎入口：协调 renderer/scene/camera 与各控制器
// 对应 iOS StudioView + ARCameraView 的编排层
import * as THREE from "three";
import {
  AppMode,
  FocalLength,
  nextFocalLength,
  focalLengthToFOV,
} from "../../shared/types";
import { makeStudioRoot } from "./SceneEnvironment";
import { makeHumanFigure, setHumanSelected } from "./HumanFigureFactory";
import { OrbitCameraController } from "./OrbitCameraController";
import { DeviceOrientationCameraController } from "./DeviceOrientationCameraController";
import { VirtualCameraController } from "./VirtualCameraController";
import { Recorder } from "./Recorder";

/** 生成 UUID（兼容不支持 crypto.randomUUID 的环境） */
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** 轨道相机姿态同步负载 */
export interface TransformUpdatePayload {
  azimuth: number;
  elevation: number;
  distance: number;
  target: [number, number, number];
}

/**
 * 场景管理器：引擎入口，协调所有控制器。
 *
 * - edit 模式：orbitController 驱动相机，setAnimationLoop 走 requestAnimationFrame
 * - camera 模式：优先尝试 WebXR AR，失败回退到 virtualController
 * - AR 模式：renderer.xr.presenting 时 setAnimationLoop 走 XR 帧回调
 */
export class SceneManager {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private studioRoot!: THREE.Group;

  orbitController!: OrbitCameraController;
  private motionController!: DeviceOrientationCameraController;
  virtualController!: VirtualCameraController;
  private recorder!: Recorder;

  private humans: Map<string, THREE.Group> = new Map();
  private selectedHumanId: string | null = null;
  private focalLength: FocalLength = 35;
  private mode: AppMode = "edit";
  /** AR 是否处于激活状态（供 UI 读取同步到 store） */
  arActive = false;

  /** 轨道相机姿态变更回调（供 store 同步） */
  onTransformUpdate?: (pose: TransformUpdatePayload) => void;
  /** 录制进度回调 */
  onRecordingProgress?: (durationMs: number) => void;

  /** 初始化引擎：创建 renderer/scene/camera，添加 StudioRoot，启动渲染循环 */
  init(canvas: HTMLCanvasElement): void {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;
    this.renderer.setSize(w, h, false);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1e);

    // 35mm 焦段对应水平 FOV ≈ 54.4°（全画幅 36mm 传感器）
    this.camera = new THREE.PerspectiveCamera(54.4, w / h, 0.1, 100);

    this.orbitController = new OrbitCameraController(this.camera);
    this.motionController = new DeviceOrientationCameraController(this.orbitController);
    this.virtualController = new VirtualCameraController(this.camera);
    this.recorder = new Recorder();

    this.studioRoot = makeStudioRoot();
    this.scene.add(this.studioRoot);

    this.orbitController.updateCameraTransform();
    this.renderer.setAnimationLoop(this.renderFrame);
  }

  // === 渲染循环 ===

  private renderFrame = (_time: number, _frame?: XRFrame): void => {
    if (this.mode === "camera") {
      // 肩高放置：跳到 target 处 1.5m 高（位置由 SceneManager 统一处理）
      if (this.orbitController.pendingShoulderPlacement) {
        const target = this.orbitController.target;
        this.camera.position.set(
          target.x,
          OrbitCameraController.shoulderHeight,
          target.z,
        );
        if (!this.arActive) {
          // 虚拟相机模式：直接清除标志（motion 模式下由 applyToCamera 清除并重置 reference）
          this.orbitController.pendingShoulderPlacement = false;
        }
      }
      if (this.arActive) {
        // 陀螺仪模式：用 deviceorientation 数据驱动相机旋转（只改旋转，位置由 virtualController 管）
        this.motionController.applyToCamera(this.camera);
      }
    }
    this.renderer.render(this.scene, this.camera);

    // 同步轨道相机姿态（edit 模式下供 store 持久化）
    if (this.mode === "edit" && this.onTransformUpdate) {
      this.onTransformUpdate({
        azimuth: this.orbitController.azimuth,
        elevation: this.orbitController.elevation,
        distance: this.orbitController.distance,
        target: [
          this.orbitController.target.x,
          this.orbitController.target.y,
          this.orbitController.target.z,
        ],
      });
    }

    if (this.recorder.isRecording && this.onRecordingProgress) {
      this.onRecordingProgress(this.recorder.getDurationMs());
    }
  };

  // === 模式切换 ===

  async setMode(mode: AppMode): Promise<void> {
    if (mode === this.mode) return;

    if (mode === "camera") {
      // 锁定编辑模式姿态，作为 motion/virtual 的起点
      this.orbitController.lockEditPose();
      const initPose = this.orbitController.getWorldTransform();

      // 优先尝试陀螺仪（DeviceOrientation），不进入 AR 会话、不显示相机画面
      if (this.motionController.isSupported()) {
        try {
          await this.motionController.enter(initPose);
          this.arActive = true;
        } catch {
          // 权限被拒绝或不可用，回退到虚拟相机
          this.arActive = false;
          this.virtualController.enter(initPose);
        }
      } else {
        // 不支持陀螺仪，使用虚拟相机（鼠标拖动看方向）
        this.arActive = false;
        this.virtualController.enter(initPose);
      }
      this.applyFocalLength();
    } else {
      // 切回 edit 模式
      if (this.arActive) {
        this.motionController.exit();
        this.arActive = false;
      }
      // 从锁定姿态恢复轨道相机（保持当前 distance）
      this.orbitController.returnToLockedTransform();
      this.applyFocalLength();
    }

    this.mode = mode;
  }

  // === 人形管理 ===

  /** 添加一个人形，返回 id（对应 iOS 的 addHuman） */
  addHuman(): string {
    const id = generateUUID();
    const figure = makeHumanFigure(false, id);
    figure.position.set(0, 0, 0);
    this.studioRoot.add(figure);
    this.humans.set(id, figure);
    return id;
  }

  /** 选中人形（null 取消选中） */
  selectHuman(id: string | null): void {
    if (this.selectedHumanId) {
      const prev = this.humans.get(this.selectedHumanId);
      if (prev) setHumanSelected(prev, false);
    }
    this.selectedHumanId = id;
    if (id) {
      const curr = this.humans.get(id);
      if (curr) setHumanSelected(curr, true);
    }
  }

  /** 删除当前选中的人形 */
  deleteSelectedHuman(): void {
    if (!this.selectedHumanId) return;
    const entity = this.humans.get(this.selectedHumanId);
    if (entity) {
      entity.traverse((obj) => {
        if (obj instanceof THREE.Mesh) obj.geometry?.dispose();
      });
      entity.parent?.remove(entity);
      this.humans.delete(this.selectedHumanId);
    }
    this.selectedHumanId = null;
  }

  /** 更新人形位置 */
  updateHumanPosition(id: string, position: [number, number, number]): void {
    const entity = this.humans.get(id);
    if (entity) entity.position.set(position[0], position[1], position[2]);
  }

  /** 更新人形 Y 轴旋转 */
  updateHumanRotation(id: string, rotationY: number): void {
    const entity = this.humans.get(id);
    if (entity) entity.rotation.y = rotationY;
  }

  /** 旋转当前选中人形（增量） */
  rotateSelectedHuman(delta: number): void {
    if (!this.selectedHumanId) return;
    const entity = this.humans.get(this.selectedHumanId);
    if (entity) entity.rotation.y += delta;
  }

  /**
   * 同步人形列表到引擎（对应 iOS SceneContentBuilder.syncHumans）。
   * 用签名比对避免无谓重建；选中态变化只更新材质不重建。
   */
  syncHumans(
    placements: Array<{ id: string; position: [number, number, number]; rotationY: number }>,
    selectedID: string | null,
  ): void {
    const placementIDs = new Set(placements.map((p) => p.id));

    // 删除不再存在的人形
    for (const [id, entity] of this.humans) {
      if (!placementIDs.has(id)) {
        entity.traverse((obj) => {
          if (obj instanceof THREE.Mesh) obj.geometry?.dispose();
        });
        entity.parent?.remove(entity);
        this.humans.delete(id);
      }
    }

    // 新增或更新
    for (const p of placements) {
      const isSelected = p.id === selectedID;
      let entity = this.humans.get(p.id);
      if (!entity) {
        entity = makeHumanFigure(isSelected, p.id);
        entity.position.set(p.position[0], p.position[1], p.position[2]);
        entity.rotation.y = p.rotationY;
        this.studioRoot.add(entity);
        this.humans.set(p.id, entity);
      } else {
        entity.position.set(p.position[0], p.position[1], p.position[2]);
        entity.rotation.y = p.rotationY;
        setHumanSelected(entity, isSelected);
      }
    }

    this.selectedHumanId = selectedID;
  }

  // === 焦段 ===

  /** 切换到下一个焦段（35→50→75→200→35） */
  cycleFocalLength(): void {
    this.focalLength = nextFocalLength(this.focalLength);
    this.applyFocalLength();
  }

  /** 直接设置焦段（供 store 同步用） */
  setFocalLength(focal: FocalLength): void {
    if (focal === this.focalLength) return;
    this.focalLength = focal;
    this.applyFocalLength();
  }

  private applyFocalLength(): void {
    this.camera.fov = focalLengthToFOV(this.focalLength);
    this.camera.updateProjectionMatrix();
  }

  // === 录制 ===

  startRecording(): void {
    this.recorder.start(this.renderer.domElement, 30);
  }

  async stopRecording(): Promise<Blob> {
    return this.recorder.stop();
  }

  // === 工具方法 ===

  /** 获取当前画面缩略图（PNG dataURL） */
  getThumbnail(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL("image/png");
  }

  /** 画布尺寸变化时调用 */
  onResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  /** 释放所有资源 */
  dispose(): void {
    this.renderer.setAnimationLoop(null);
    if (this.arActive) {
      this.motionController.exit();
    }
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else (mat as THREE.Material)?.dispose?.();
      }
    });
    this.renderer.dispose();
  }
}
