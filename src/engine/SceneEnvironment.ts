// 复刻 iOS SceneEnvironment.swift
// 用 Three.js 构建摄影棚环境：棋盘格地板 + 网格线 + 三色坐标轴 + 双方向光
import * as THREE from "three";

// 颜色常量（与 Swift 静态属性一一对应）
const studioGrey = 0x383838; // 0.22, 0.22, 0.22
const gridLineColor = 0x525252; // 0.32, 0.32, 0.32
const axisXColor = new THREE.Color(0.85, 0.25, 0.25);
const axisYColor = new THREE.Color(0.35, 0.75, 0.35);
const axisZColor = new THREE.Color(0.30, 0.45, 0.90);

export { studioGrey };

/**
 * 创建摄影棚根节点，对应 Swift 的 SceneEnvironment.makeStudioRoot()
 */
export function makeStudioRoot(): THREE.Group {
  const root = new THREE.Group();
  root.name = "StudioRoot";

  addCheckerboard(root);
  addGrid(root);
  addAxes(root);
  addLighting(root);

  return root;
}

/** 棋盘格地板：20x20 格，每格 1m，仅 (i+j)%2==0 的格子渲染 */
function addCheckerboard(root: THREE.Group): void {
  const gridSize = 10;
  const divisions = 20;
  const step = (gridSize * 2) / divisions;

  // PlaneGeometry 默认在 XY 平面，旋转 -90° 使其平铺在 XZ 地面
  const tileGeo = new THREE.PlaneGeometry(step, step);
  tileGeo.rotateX(-Math.PI / 2);
  const tileMat = new THREE.MeshStandardMaterial({
    color: 0x565656, // 0.34, 0.34, 0.34
    roughness: 1,
    metalness: 0,
  });

  for (let i = 0; i < divisions; i++) {
    for (let j = 0; j < divisions; j++) {
      if ((i + j) % 2 !== 0) continue;
      const tile = new THREE.Mesh(tileGeo, tileMat);
      const x = -gridSize + (i + 0.5) * step;
      const z = -gridSize + (j + 0.5) * step;
      tile.position.set(x, 0, z);
      root.add(tile);
    }
  }
}

/** 网格线：LineSegments + LineBasicMaterial，y=0.001 避免 z-fighting */
function addGrid(root: THREE.Group): void {
  const gridSize = 10;
  const divisions = 20;
  const step = (gridSize * 2) / divisions;
  const y = 0.001;

  const points: number[] = [];
  for (let i = 0; i <= divisions; i++) {
    const offset = -gridSize + i * step;
    // 沿 X 方向的线
    points.push(offset, y, -gridSize, offset, y, gridSize);
    // 沿 Z 方向的线
    points.push(-gridSize, y, offset, gridSize, y, offset);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  const mat = new THREE.LineBasicMaterial({ color: gridLineColor });
  root.add(new THREE.LineSegments(geo, mat));
}

/** 三色坐标轴：X 红 / Y 绿 / Z 蓝，长 1.2，粗 0.012 的 BoxGeometry。
 *  直接用对应轴向的盒子尺寸，避免旋转（与 Swift addLine 几何等效） */
function addAxes(root: THREE.Group): void {
  const length = 1.2;
  const thickness = 0.012;

  // X 轴：长边在 X，从原点延伸到 (length, 0, 0)
  const xMesh = new THREE.Mesh(
    new THREE.BoxGeometry(length, thickness, thickness),
    new THREE.MeshBasicMaterial({ color: axisXColor }),
  );
  xMesh.position.set(length / 2, 0, 0);
  root.add(xMesh);

  // Y 轴：长边在 Y
  const yMesh = new THREE.Mesh(
    new THREE.BoxGeometry(thickness, length, thickness),
    new THREE.MeshBasicMaterial({ color: axisYColor }),
  );
  yMesh.position.set(0, length / 2, 0);
  root.add(yMesh);

  // Z 轴：长边在 Z
  const zMesh = new THREE.Mesh(
    new THREE.BoxGeometry(thickness, thickness, length),
    new THREE.MeshBasicMaterial({ color: axisZColor }),
  );
  zMesh.position.set(0, 0, length / 2);
  root.add(zMesh);
}

/** 双方向光：keyLight + fillLight。RealityKit 强度 1200/400 → Three.js 2.5/0.8 */
function addLighting(root: THREE.Group): void {
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
  keyLight.position.set(4, 6, 4);
  keyLight.target.position.set(0, 0, 0);
  root.add(keyLight);
  root.add(keyLight.target);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
  fillLight.position.set(-3, 2, -2);
  fillLight.target.position.set(0, 0, 0);
  root.add(fillLight);
  root.add(fillLight.target);
}
