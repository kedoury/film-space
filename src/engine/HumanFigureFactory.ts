// 复刻 iOS HumanFigureFactory.swift
// 用 Three.js 构建约 1.75m 高的简化人形，脚在 y=0
import * as THREE from "three";

// 颜色常量（与 Swift 静态属性一一对应）
const skinColor = new THREE.Color(0.76, 0.60, 0.42);
const clothingColor = new THREE.Color(0.35, 0.38, 0.45);
// UIColor.systemBlue 近似值
const selectedColor = new THREE.Color(0.29, 0.51, 0.96);

// 身体各部位的几何尺寸/位置/旋转定义（与 Swift addPart 调用 1:1 对应）
interface PartSpec {
  // [x, y, z]
  size: [number, number, number];
  position: [number, number, number];
  rotation?: [number, number, number]; // [x, y, z] 弧度
  isSphere?: boolean; // true 用 SphereGeometry，否则 BoxGeometry
  useSkin?: boolean; // true 用 skin 材质，否则 clothing
}

const PARTS: PartSpec[] = [
  // 头部：球体 r=0.11 @ (0, 1.62, 0)（球体仅使用 size[0] 作为半径）
  { size: [0.11, 0.11, 0.11], position: [0, 1.62, 0], isSphere: true, useSkin: true },
  // 躯干：box (0.36, 0.48, 0.18) @ (0, 1.22, 0)
  { size: [0.36, 0.48, 0.18], position: [0, 1.22, 0] },
  // 上臂 L：box (0.11, 0.38, 0.11) @ (-0.24, 1.28, 0) rot z=0.35
  { size: [0.11, 0.38, 0.11], position: [-0.24, 1.28, 0], rotation: [0, 0, 0.35] },
  // 上臂 R：box (0.11, 0.38, 0.11) @ (0.24, 1.28, 0) rot z=-0.35
  { size: [0.11, 0.38, 0.11], position: [0.24, 1.28, 0], rotation: [0, 0, -0.35] },
  // 前臂 L：box (0.09, 0.34, 0.09) @ (-0.38, 1.08, 0) rot z=0.15 (skin)
  { size: [0.09, 0.34, 0.09], position: [-0.38, 1.08, 0], rotation: [0, 0, 0.15], useSkin: true },
  // 前臂 R：box (0.09, 0.34, 0.09) @ (0.38, 1.08, 0) rot z=-0.15 (skin)
  { size: [0.09, 0.34, 0.09], position: [0.38, 1.08, 0], rotation: [0, 0, -0.15], useSkin: true },
  // 大腿 L：box (0.13, 0.82, 0.13) @ (-0.11, 0.58, 0)
  { size: [0.13, 0.82, 0.13], position: [-0.11, 0.58, 0] },
  // 大腿 R：box (0.13, 0.82, 0.13) @ (0.11, 0.58, 0)
  { size: [0.13, 0.82, 0.13], position: [0.11, 0.58, 0] },
  // 脚 L：box (0.14, 0.08, 0.24) @ (-0.11, 0.04, 0.02) (skin)
  { size: [0.14, 0.08, 0.24], position: [-0.11, 0.04, 0.02], useSkin: true },
  // 脚 R：box (0.14, 0.08, 0.24) @ (0.11, 0.04, 0.02) (skin)
  { size: [0.14, 0.08, 0.24], position: [0.11, 0.04, 0.02], useSkin: true },
];

/**
 * 创建人形实体，对应 Swift 的 HumanFigureFactory.makeHumanFigure(isSelected:)
 *
 * @param isSelected 是否选中（选中时衣服变蓝）
 * @param humanId    对应 iOS HumanTagComponent 的 id，写入 root.userData.humanId
 */
export function makeHumanFigure(isSelected: boolean, humanId?: string): THREE.Group {
  const root = new THREE.Group();
  root.name = "HumanFigure";

  const skinMat = new THREE.MeshStandardMaterial({
    color: skinColor,
    roughness: 0.6,
    metalness: 0,
  });
  const clothingMat = new THREE.MeshStandardMaterial({
    color: isSelected ? selectedColor : clothingColor,
    roughness: 0.5,
    metalness: 0,
  });

  for (const spec of PARTS) {
    const mesh = makePartMesh(spec, spec.useSkin ? skinMat : clothingMat);
    root.add(mesh);
  }

  // userData.humanId 用于选择命中（对应 iOS 的 HumanTagComponent + InputTargetComponent）
  if (humanId !== undefined) {
    root.userData.humanId = humanId;
  }
  // 标记为可选实体，便于射线检测过滤
  root.userData.selectable = true;
  // 保存 clothing 材质引用，便于 setHumanSelected 直接改色（避免重建几何体）
  root.userData.clothingMaterial = clothingMat;

  return root;
}

/**
 * 切换人形选中状态（仅改 clothing 材质颜色，不重建几何体）。
 * 对应 Swift 中重建 figure 时 isSelected 参数变化的等效行为。
 */
export function setHumanSelected(entity: THREE.Group, selected: boolean): void {
  const mat = entity.userData.clothingMaterial as THREE.MeshStandardMaterial | undefined;
  if (mat) {
    mat.color.copy(selected ? selectedColor : clothingColor);
  }
}

/** 根据 PartSpec 生成对应的 Mesh，应用位置与旋转 */
function makePartMesh(spec: PartSpec, material: THREE.Material): THREE.Mesh {
  let geo: THREE.BufferGeometry;
  if (spec.isSphere) {
    // SphereGeometry 半径 = spec.size[0]
    geo = new THREE.SphereGeometry(spec.size[0], 24, 16);
  } else {
    const [sx, sy, sz] = spec.size;
    geo = new THREE.BoxGeometry(sx, sy, sz);
  }

  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(spec.position[0], spec.position[1], spec.position[2]);

  if (spec.rotation) {
    // Swift 用 ZYX 顺序组合（quatZ * quatY * quatX），Three.js Euler 'ZYX' 等效
    mesh.rotation.set(spec.rotation[0], spec.rotation[1], spec.rotation[2], "ZYX");
  }

  return mesh;
}
