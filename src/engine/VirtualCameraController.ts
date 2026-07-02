// 降级方案：用 WASD/摇杆驱动的第一人称相机
// 当 WebXR AR 不可用时，作为 camera 模式的替代控制器
import * as THREE from "three";
import { FocalLength, focalLengthToFOV } from "../../shared/types";

/**
 * 第一人称虚拟相机控制器。
 *
 * 用 yaw/pitch 表示朝向（避免万向锁），位置直接存储。
 * forward = (-sin(yaw)*cos(pitch), sin(pitch), -cos(yaw)*cos(pitch))
 */
export class VirtualCameraController {
  camera: THREE.PerspectiveCamera;

  /** 航向角（绕 Y 轴，弧度） */
  private yaw = 0;
  /** 俯仰角（绕 X 轴，弧度），限幅到 [-1.45, 1.45] 与 OrbitCameraController 一致 */
  private pitch = 0;

  private lockedTransform: THREE.Matrix4 | null = null;
  private currentFocal: FocalLength = 35;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  /** 鼠标拖动改变朝向 */
  lookDelta(yawDelta: number, pitchDelta: number): void {
    this.yaw += yawDelta;
    this.pitch = Math.min(Math.max(this.pitch + pitchDelta, -1.45), 1.45);
    this.applyToCamera();
  }

  /** 沿相机水平投影的 right 方向移动 */
  moveHorizontal(delta: number): void {
    // right = (cos(yaw), 0, -sin(yaw))
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.camera.position.addScaledVector(right, delta);
    this.applyToCamera();
  }

  /** 沿相机水平投影的 forward 方向移动 */
  moveForward(delta: number): void {
    // forward = (-sin(yaw), 0, -cos(yaw))
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.camera.position.addScaledVector(forward, delta);
    this.applyToCamera();
  }

  /** 沿世界 Y 轴上下移动 */
  moveVertical(delta: number): void {
    this.camera.position.y += delta;
    this.applyToCamera();
  }

  /** 设置焦段，更新 FOV（全画幅 36mm 传感器） */
  setFocalLength(focal: FocalLength): void {
    this.currentFocal = focal;
    this.camera.fov = focalLengthToFOV(focal);
    this.camera.updateProjectionMatrix();
  }

  /** 锁定当前姿态，返回矩阵（供 AR 模式或 recenter 使用） */
  lockCurrentPose(): THREE.Matrix4 {
    this.lockedTransform = this.camera.matrixWorld.clone();
    return this.lockedTransform;
  }

  /** 恢复到锁定姿态 */
  returnToLocked(): void {
    if (!this.lockedTransform) return;
    this.applyMatrix(this.lockedTransform);
  }

  /** 从编辑模式姿态无缝进入（分解矩阵为 position + yaw + pitch） */
  enter(initPose: THREE.Matrix4): void {
    this.applyMatrix(initPose);
    this.lockedTransform = initPose.clone();
  }

  /** 把 yaw/pitch + position 写入相机 */
  private applyToCamera(): void {
    // 用欧拉角 YXZ 顺序：先绕 Y（yaw），再绕 X（pitch），与第一人称相机一致
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    this.camera.updateMatrixWorld();
  }

  /** 从 4x4 矩阵分解出 position + yaw + pitch 并应用 */
  private applyMatrix(m: THREE.Matrix4): void {
    const e = m.elements;
    // 平移
    this.camera.position.set(e[12], e[13], e[14]);
    // forward = (-e[8], -e[9], -e[10])
    const forwardX = -e[8];
    const forwardY = -e[9];
    const forwardZ = -e[10];
    // yaw = atan2(forward.x, forward.z)
    this.yaw = Math.atan2(forwardX, forwardZ);
    // pitch = asin(forward.y)（forward 已是单位向量的旋转结果）
    this.pitch = Math.asin(Math.min(Math.max(forwardY, -1), 1));
    this.applyToCamera();
  }
}
