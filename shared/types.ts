// 共享类型定义（前后端同步）
// 对应 PRD/TECH 文档中的 API 契约

export type AppMode = "edit" | "camera";

export type FocalLength = 35 | 50 | 75 | 200;

export const FOCAL_LENGTHS: FocalLength[] = [35, 50, 75, 200];

export interface HumanPlacement {
  id: string; // UUID v4
  position: [number, number, number]; // [x, y, z]
  rotationY: number;
}

export interface SceneState {
  mode: AppMode;
  humans: HumanPlacement[];
  selectedHumanID: string | null;
  focalLength: FocalLength;
  isRecording: boolean;
}

export interface OrbitCameraPose {
  azimuth: number;
  elevation: number;
  distance: number;
  target: [number, number, number];
}

export interface SceneMeta {
  id: string;
  name: string;
  createdAt: string; // ISO 8601
  updatedAt: string;
  thumbnailURL: string; // /api/scenes/:id/thumbnail
  state: SceneState;
  cameraPose: OrbitCameraPose;
  shareToken?: string;
}

export interface VideoMeta {
  id: string;
  name: string;
  createdAt: string;
  durationMs: number;
  width: number;
  height: number;
  sizeBytes: number;
  thumbnailURL: string;
  fileURL: string; // /api/videos/:id/file
  shareToken?: string;
}

export interface APIError {
  error: string;
  code: string;
}

// 焦段对应的水平视场角（全画幅 36mm 传感器）
export function focalLengthToFOV(focal: FocalLength): number {
  const sensorWidth = 36;
  return (2 * Math.atan(sensorWidth / (2 * focal)) * 180) / Math.PI;
}

export function nextFocalLength(focal: FocalLength): FocalLength {
  const idx = FOCAL_LENGTHS.indexOf(focal);
  return FOCAL_LENGTHS[(idx + 1) % FOCAL_LENGTHS.length];
}

// 默认场景状态
export const DEFAULT_SCENE_STATE: SceneState = {
  mode: "edit",
  humans: [],
  selectedHumanID: null,
  focalLength: 35,
  isRecording: false,
};

// 默认轨道相机姿态（与 iOS 版 OrbitCameraController 默认值一致）
export const DEFAULT_CAMERA_POSE: OrbitCameraPose = {
  azimuth: 0.6,
  elevation: 0.35,
  distance: 6,
  target: [0, 0.8, 0],
};

// 肩高放置的相机高度（与 iOS 版 shoulderHeight 一致）
export const SHOULDER_HEIGHT = 1.5;
