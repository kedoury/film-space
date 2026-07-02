// 复刻 iOS ARCameraView 的 applyDeviceMotion 核心逻辑
// 用 WebXR API 实现设备位姿跟踪 + 编辑模式姿态叠加
import * as THREE from "three";
import { OrbitCameraController } from "./OrbitCameraController";

// 从 4x4 列主序矩阵中提取平移分量（对应 Swift translation(m)）
function getTranslation(m: THREE.Matrix4): THREE.Vector3 {
  const e = m.elements;
  return new THREE.Vector3(e[12], e[13], e[14]);
}

/** 提取矩阵的旋转部分（3x3）作为新的 Matrix4，对应 Swift rotation(m) */
function extractRotation(m: THREE.Matrix4): THREE.Matrix4 {
  const e = m.elements;
  // 复制前三列（旋转部分），平移列清零
  const r = new THREE.Matrix4();
  r.set(
    e[0], e[4], e[8], 0,
    e[1], e[5], e[9], 0,
    e[2], e[6], e[10], 0,
    0, 0, 0, 1,
  );
  return r;
}

/** 计算 camera-to-world 矩阵的 yaw（绕世界 Y 轴的航向角）
 *  forward = (-m[8], -m[9], -m[10])，yaw = atan2(forward.x, forward.z)
 *  对应 Swift yaw(of:) */
function yawOfMatrix(m: THREE.Matrix4): number {
  const e = m.elements;
  const forwardX = -e[8];
  const forwardZ = -e[10];
  return Math.atan2(forwardX, forwardZ);
}

/**
 * WebXR AR 控制器，对应 iOS ARCameraView.Coordinator 的 applyDeviceMotion 部分。
 *
 * 核心算法：
 *   1. 进入时记录 editCameraTransform（编辑模式姿态）和 referenceTransform（设备初始姿态）
 *   2. 每帧用设备相对旋转叠加到 edit 旋转，得到 newRotation
 *   3. 用设备世界位移经 yaw 对齐后叠加到 edit 平移，得到 newPosition
 */
export class WebXRARController {
  private renderer: THREE.WebGLRenderer | null = null;
  private session: XRSession | null = null;
  private referenceSpace: XRReferenceSpace | null = null;

  /** 编辑模式姿态（基准） */
  private editCameraTransform: THREE.Matrix4;
  /** 进入 AR 后首帧设备姿态（用于计算 delta） */
  private referenceTransform: THREE.Matrix4 | null = null;

  /** 由 SceneManager 注入的相机控制器（用于消费 pendingRecenter / pendingShoulderPlacement） */
  private orbitController: OrbitCameraController;

  constructor(orbitController: OrbitCameraController) {
    this.orbitController = orbitController;
    this.editCameraTransform = orbitController.getWorldTransform().clone();
  }

  /** 是否支持 immersive-ar 会话 */
  async isSupported(): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.xr) return false;
    try {
      return await navigator.xr.isSessionSupported("immersive-ar");
    } catch {
      return false;
    }
  }

  /** 进入 AR 会话，初始化 referenceSpace，记录初始姿态 */
  async enter(renderer: THREE.WebGLRenderer, initPose: THREE.Matrix4): Promise<void> {
    this.renderer = renderer;
    this.editCameraTransform = initPose.clone();
    this.referenceTransform = null;

    const session = await navigator.xr!.requestSession("immersive-ar", {
      optionalFeatures: ["local-floor", "dom-overlay"],
    });
    this.session = session;

    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType("local");
    await renderer.xr.setSession(session);
    // 获取 referenceSpace：优先从 renderer.xr 取，失败则手动创建
    this.referenceSpace = renderer.xr.getReferenceSpace();
    if (!this.referenceSpace) {
      this.referenceSpace = await session.requestReferenceSpace("local");
    }
  }

  /** 每帧调用：从 XRFrame 取 viewer pose，应用 applyDeviceMotion 算法 */
  onFrame(frame: XRFrame, camera: THREE.PerspectiveCamera): void {
    if (!this.referenceSpace) return;
    const pose = frame.getViewerPose(this.referenceSpace);
    if (!pose) return;

    // deviceTransform = viewer pose 的世界矩阵（列主序，与 THREE.Matrix4 兼容）
    const deviceTransform = new THREE.Matrix4().fromArray(
      pose.transform.matrix as unknown as number[],
    );

    this.applyDeviceMotion(deviceTransform, camera);
  }

  /** applyDeviceMotion 1:1 复刻 ARCameraView.Coordinator.applyDeviceMotion */
  private applyDeviceMotion(deviceTransform: THREE.Matrix4, camera: THREE.PerspectiveCamera): void {
    // 1) Return-to-lock：把相机拉回锁定点，以当前设备位置为新基准
    if (this.orbitController.pendingRecenter && this.orbitController.lockedTransform) {
      this.editCameraTransform = this.orbitController.lockedTransform.clone();
      this.referenceTransform = deviceTransform.clone();
      this.orbitController.pendingRecenter = false;
    }

    // 2) Shoulder placement：跳到 target 处 1.5m 高，保留设备当前朝向
    if (this.orbitController.pendingShoulderPlacement) {
      const placed = deviceTransform.clone();
      const target = this.orbitController.target;
      placed.elements[12] = target.x;
      placed.elements[13] = OrbitCameraController.shoulderHeight;
      placed.elements[14] = target.z;
      placed.elements[15] = 1;
      this.editCameraTransform = placed;
      this.referenceTransform = deviceTransform.clone();
      this.orbitController.pendingShoulderPlacement = false;
    }

    // 3) 首帧记录 reference
    if (!this.referenceTransform) {
      this.referenceTransform = deviceTransform.clone();
    }
    const reference = this.referenceTransform;
    const edit = this.editCameraTransform;

    // 4) 旋转：edit 朝向 * (reference^T * device) 的相对旋转
    const refRot = extractRotation(reference);
    const devRot = extractRotation(deviceTransform);
    const editRot = extractRotation(edit);
    // deltaRotation 矩阵 = reference^T * device
    const deltaRotMatrix = refRot.transpose().multiply(devRot);
    const deltaRotation = new THREE.Quaternion().setFromRotationMatrix(deltaRotMatrix);
    // newRotation = edit 的四元数 * deltaRotation
    const editQuat = new THREE.Quaternion().setFromRotationMatrix(editRot);
    const newRotation = editQuat.multiply(deltaRotation);

    // 5) 位置：edit 平移 + yaw 对齐后的设备世界位移
    const worldDelta = getTranslation(deviceTransform).sub(getTranslation(reference));
    const yawAlign = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      yawOfMatrix(edit) - yawOfMatrix(reference),
    );
    // yawAlign.act(worldDelta)
    worldDelta.applyQuaternion(yawAlign);
    const newPosition = getTranslation(edit).add(worldDelta);

    // 6) 写入相机：Transform(scale:1, rotation: newRotation, translation: newPosition)
    camera.position.copy(newPosition);
    camera.quaternion.copy(newRotation);
    camera.scale.set(1, 1, 1);
    camera.updateMatrixWorld();

    // 同步给 orbitController.liveCameraTransform（供 lock 按钮捕获）
    this.orbitController.liveCameraTransform = camera.matrixWorld.clone();
  }

  /** 请求返回锁定姿态（由 UI 按钮触发） */
  requestRecenter(): void {
    this.orbitController.pendingRecenter = true;
  }

  /** 请求肩高放置（由 UI 按钮触发） */
  requestShoulderPlacement(): void {
    this.orbitController.pendingShoulderPlacement = true;
  }

  /** 退出 AR 会话，清理状态 */
  async exit(): Promise<void> {
    if (this.renderer) {
      this.renderer.xr.enabled = false;
      await this.renderer.xr.setSession(null);
    }
    if (this.session) {
      try {
        await this.session.end();
      } catch {
        // 会话可能已结束
      }
      this.session = null;
    }
    this.referenceSpace = null;
    this.referenceTransform = null;
  }
}
