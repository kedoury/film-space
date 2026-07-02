// 复刻 iOS OrbitCameraController.swift（完整 1:1 复刻所有方法）
// 用 Three.js 实现：轨道相机控制器，编辑模式驱动 PerspectiveCamera
import * as THREE from "three";

/**
 * 轨道相机控制器，对应 Swift 的 OrbitCameraController。
 *
 * 相机绕 target 做球面运动：
 *   eye = target + (horizontal*sin(az), dist*sin(elev), horizontal*cos(az))
 *   其中 horizontal = distance * cos(elevation)
 */
export class OrbitCameraController {
  azimuth = 0.6;
  elevation = 0.35;
  distance = 6;
  target = new THREE.Vector3(0, 0.8, 0);

  camera: THREE.PerspectiveCamera;

  /** 锁定的编辑模式姿态（进入 camera 模式时作为基准） */
  lockedTransform: THREE.Matrix4 | null = null;
  /** camera 模式下由 AR 视图写入的实时姿态，供 lock 按钮捕获 */
  liveCameraTransform: THREE.Matrix4 | null = null;
  /** 由 camera 模式的"返回"按钮置位；AR 视图消费后清零，把相机拉回锁定点 */
  pendingRecenter = false;
  /** 由 camera 模式的"肩高"按钮置位；AR 视图消费后清零，把相机放到 target 处 1.5m 高 */
  pendingShoulderPlacement = false;

  /** 肩高放置的相机高度（与 Swift shoulderHeight 一致） */
  static readonly shoulderHeight = 1.5;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  /** 轨道旋转：方位角累加，俯仰角限幅到 [-1.45, 1.45] */
  orbit(deltaAzimuth: number, deltaElevation: number): void {
    this.azimuth += deltaAzimuth;
    this.elevation = Math.min(Math.max(this.elevation + deltaElevation, -1.45), 1.45);
    this.updateCameraTransform();
  }

  /** 平移 target：以相机朝向投影到水平面的 right / up 为基准 */
  pan(deltaX: number, deltaY: number): void {
    const cosA = Math.cos(this.azimuth);
    const sinA = Math.sin(this.azimuth);
    const right = new THREE.Vector3(cosA, 0, -sinA);
    const up = new THREE.Vector3(0, 1, 0);
    const scale = this.distance * 0.0015;
    // Swift: target += right * (-deltaX * scale) + up * (deltaY * scale)
    this.target.addScaledVector(right, -deltaX * scale);
    this.target.addScaledVector(up, deltaY * scale);
    this.updateCameraTransform();
  }

  /** 缩放：distance / scale，限幅 [1.5, 20] */
  zoom(scale: number): void {
    this.distance = Math.min(Math.max(this.distance / scale, 1.5), 20);
    this.updateCameraTransform();
  }

  /** 沿世界 Y 轴上下移动 target */
  moveVertically(delta: number): void {
    this.target.y += delta;
    this.updateCameraTransform();
  }

  /** 沿当前视角的水平 right 方向移动 target */
  moveHorizontally(delta: number): void {
    const right = new THREE.Vector3(Math.cos(this.azimuth), 0, -Math.sin(this.azimuth));
    this.target.addScaledVector(right, delta);
    this.updateCameraTransform();
  }

  /** 沿当前视角投影到地面的 forward 方向移动 target */
  moveForward(delta: number): void {
    const forward = new THREE.Vector3(-Math.sin(this.azimuth), 0, -Math.cos(this.azimuth));
    this.target.addScaledVector(forward, delta);
    this.updateCameraTransform();
  }

  /** 锁定当前编辑模式姿态，作为进入 camera 模式的起点 */
  lockEditPose(): void {
    this.lockedTransform = this.getWorldTransform();
  }

  /** 从锁定姿态恢复轨道参数（保持当前 distance） */
  returnToLockedTransform(): void {
    if (!this.lockedTransform) return;
    const m = this.lockedTransform;
    const elements = m.elements;
    // Swift: m.columns.3 → 平移列；Three.js Matrix4.elements 是列主序，
    // elements[12..14] 即第 4 列 (translation)
    const eye = new THREE.Vector3(elements[12], elements[13], elements[14]);
    // Swift: forward = normalize(-m.columns.2) → Three.js elements[8..10] 是第 3 列
    const forward = new THREE.Vector3(-elements[8], -elements[9], -elements[10]).normalize();
    // dir = -forward（从 target 指向 eye 的方向）
    const dir = forward.clone().negate();
    this.elevation = Math.asin(Math.min(Math.max(dir.y, -1), 1));
    this.azimuth = Math.atan2(dir.x, dir.z);
    // target = eye - dir * distance
    this.target.copy(eye).addScaledVector(dir, -this.distance);
    this.updateCameraTransform();
  }

  /** 根据当前 azimuth/elevation/distance/target 更新相机位姿 */
  updateCameraTransform(): void {
    const horizontal = this.distance * Math.cos(this.elevation);
    const x = horizontal * Math.sin(this.azimuth);
    const y = this.distance * Math.sin(this.elevation);
    const z = horizontal * Math.cos(this.azimuth);

    this.camera.position.set(
      this.target.x + x,
      this.target.y + y,
      this.target.z + z,
    );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  /** 当前相机到世界的变换矩阵（与 Swift worldTransform 一致） */
  getWorldTransform(): THREE.Matrix4 {
    const horizontal = this.distance * Math.cos(this.elevation);
    const x = horizontal * Math.sin(this.azimuth);
    const y = this.distance * Math.sin(this.elevation);
    const z = horizontal * Math.cos(this.azimuth);
    const eye = new THREE.Vector3(
      this.target.x + x,
      this.target.y + y,
      this.target.z + z,
    );
    return lookAtTransform(eye, this.target, new THREE.Vector3(0, 1, 0));
  }
}

/**
 * 构造 lookAt 变换矩阵（与 Swift OrbitCameraController.lookAtTransform 一致）。
 *
 * zAxis = normalize(eye - center)
 * xAxis = normalize(cross(up, zAxis))
 * yAxis = cross(zAxis, xAxis)
 * 矩阵列：[xAxis,0] [yAxis,0] [zAxis,0] [eye,1]
 */
export function lookAtTransform(
  eye: THREE.Vector3,
  center: THREE.Vector3,
  up: THREE.Vector3,
): THREE.Matrix4 {
  const zAxis = eye.clone().sub(center).normalize();
  const xAxis = up.clone().cross(zAxis).normalize();
  const yAxis = zAxis.clone().cross(xAxis);

  // Three.js Matrix4.makeBasis(x, y, z) 用列向量构造，正好对应 Swift 的列构造
  const m = new THREE.Matrix4();
  m.makeBasis(xAxis, yAxis, zAxis);
  m.setPosition(eye);
  return m;
}
