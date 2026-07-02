// 设备朝向相机控制器
// 对应 iOS ARKit .nonAR 模式：只跟踪设备旋转，不显示相机画面
//
// 用 DeviceOrientationEvent 获取 alpha/beta/gamma，
// 转换为四元数后应用 applyDeviceMotion 的旋转部分。
//
// 与 WebXR AR 的区别：
// - 不进入 immersive-ar 会话，不请求相机权限，不显示相机透传
// - 只有 3DoF 旋转跟踪，无位置跟踪
// - 位置由 VirtualCameraController（摇杆/WASD）控制
import * as THREE from "three";
import { OrbitCameraController } from "./OrbitCameraController";

/**
 * 设备朝向相机控制器。
 *
 * 核心算法（与 WebXRARController.applyDeviceMotion 旋转部分一致）：
 *   1. 进入时记录 editRotation（编辑模式朝向）和 referenceQuat（设备初始朝向）
 *   2. 每帧 delta = reference^-1 * device，newRotation = edit * delta
 *   3. 只写入 camera.quaternion，不触碰 camera.position
 */
export class DeviceOrientationCameraController {
  /** 编辑模式朝向（基准旋转） */
  private editRotation: THREE.Quaternion;
  /** 进入后首帧设备朝向（用于计算 delta） */
  private referenceQuat: THREE.Quaternion | null = null;
  /** 最新设备朝向四元数 */
  private latestDeviceQuat: THREE.Quaternion | null = null;

  /** 由 SceneManager 注入的轨道控制器（用于消费 pendingRecenter / pendingShoulderPlacement） */
  private orbitController: OrbitCameraController;

  constructor(orbitController: OrbitCameraController) {
    this.orbitController = orbitController;
    this.editRotation = new THREE.Quaternion().setFromRotationMatrix(
      orbitController.getWorldTransform(),
    );
  }

  /** 是否支持 deviceorientation 事件 */
  isSupported(): boolean {
    return typeof window !== "undefined" && "DeviceOrientationEvent" in window;
  }

  /** iOS 13+ 需要用户手势触发权限请求；Android 直接返回 true */
  async requestPermission(): Promise<boolean> {
    const DOE = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    if (typeof DOE.requestPermission === "function") {
      try {
        const result = await DOE.requestPermission();
        return result === "granted";
      } catch {
        return false;
      }
    }
    return true;
  }

  /** 开始监听 deviceorientation，记录初始朝向 */
  async enter(initPose: THREE.Matrix4): Promise<void> {
    this.editRotation = new THREE.Quaternion().setFromRotationMatrix(initPose);
    this.referenceQuat = null;
    this.latestDeviceQuat = null;

    const granted = await this.requestPermission();
    if (!granted) {
      throw new Error("设备朝向权限被拒绝");
    }

    window.addEventListener("deviceorientation", this.handleOrientation, true);
  }

  /** deviceorientation 事件回调：把 alpha/beta/gamma 转为四元数 */
  private handleOrientation = (event: DeviceOrientationEvent) => {
    if (event.alpha === null || event.beta === null || event.gamma === null) {
      return;
    }
    // W3C deviceorientation 规范：
    //   alpha: 绕 Z 轴（罗盘方向，0-360°）
    //   beta:  绕 X 轴（前后倾斜，-180° 到 180°）
    //   gamma: 绕 Y 轴（左右倾斜，-90° 到 90°）
    // Three.js 等效：Euler('YXZ', beta, alpha, -gamma)
    const alpha = THREE.MathUtils.degToRad(event.alpha);
    const beta = THREE.MathUtils.degToRad(event.beta);
    const gamma = THREE.MathUtils.degToRad(event.gamma);

    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(beta, alpha, -gamma, "YXZ"),
    );
    this.latestDeviceQuat = quat;
  };

  /**
   * 每帧调用：把设备相对旋转叠加到编辑模式朝向，写入 camera.quaternion。
   * 只改旋转，不改位置——位置由 VirtualCameraController 管理。
   */
  applyToCamera(camera: THREE.PerspectiveCamera): void {
    if (!this.latestDeviceQuat) return;

    // 1) Return-to-lock：把相机旋转拉回锁定点，以当前设备朝向为新基准
    if (
      this.orbitController.pendingRecenter &&
      this.orbitController.lockedTransform
    ) {
      this.editRotation = new THREE.Quaternion().setFromRotationMatrix(
        this.orbitController.lockedTransform,
      );
      this.referenceQuat = this.latestDeviceQuat.clone();
      this.orbitController.pendingRecenter = false;
    }

    // 2) Shoulder placement：位置由 SceneManager 调用 virtualController 设置，
    //    这里只重置 reference 让旋转从当前设备朝向开始
    if (this.orbitController.pendingShoulderPlacement) {
      this.referenceQuat = this.latestDeviceQuat.clone();
      this.orbitController.pendingShoulderPlacement = false;
    }

    // 3) 首帧记录 reference
    if (!this.referenceQuat) {
      this.referenceQuat = this.latestDeviceQuat.clone();
    }

    // 4) delta = reference^-1 * device
    const delta = this.referenceQuat
      .clone()
      .invert()
      .multiply(this.latestDeviceQuat);
    // 5) newRotation = edit * delta
    const newRotation = this.editRotation.clone().multiply(delta);

    camera.quaternion.copy(newRotation);
    camera.updateMatrixWorld();

    // 同步给 orbitController.liveCameraTransform（供 lock 按钮捕获）
    this.orbitController.liveCameraTransform = camera.matrixWorld.clone();
  }

  /** 请求返回锁定姿态（由 UI 按钮触发） */
  requestRecenter(): void {
    this.orbitController.pendingRecenter = true;
  }

  /** 请求肩高放置（由 UI 按钮触发，位置由 SceneManager 处理） */
  requestShoulderPlacement(): void {
    this.orbitController.pendingShoulderPlacement = true;
  }

  /** 停止监听，清理状态 */
  exit(): void {
    window.removeEventListener("deviceorientation", this.handleOrientation, true);
    this.referenceQuat = null;
    this.latestDeviceQuat = null;
  }
}
