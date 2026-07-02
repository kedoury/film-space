// 场景状态管理（Zustand）
// 对应 iOS 版 SceneState.swift 的 @Observable class

import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type {
  AppMode,
  FocalLength,
  HumanPlacement,
  OrbitCameraPose,
  SceneState,
} from "@shared/types";
import {
  DEFAULT_CAMERA_POSE,
  DEFAULT_SCENE_STATE,
  nextFocalLength,
} from "@shared/types";

interface StudioStore {
  // 场景状态
  mode: AppMode;
  humans: HumanPlacement[];
  selectedHumanID: string | null;
  focalLength: FocalLength;
  isRecording: boolean;

  // 相机姿态
  cameraPose: OrbitCameraPose;
  locked: boolean;

  // 相机模式屏幕方向：进入相机模式时锁定为该方向
  cameraOrientation: "landscape" | "portrait";

  // AR 状态
  arSupported: boolean | null; // null = 未检测
  arActive: boolean;
  arError: string | null;

  // 录制状态
  recordingMs: number;
  recordingBlob: Blob | null;

  // 场景/视频库状态
  loadedSceneId: string | null;

  // 动作
  setMode: (mode: AppMode) => void;
  addHuman: () => void;
  deleteSelectedHuman: () => void;
  selectHuman: (id: string | null) => void;
  updateHumanPosition: (id: string, position: [number, number, number]) => void;
  updateHumanRotation: (id: string, rotationY: number) => void;
  rotateSelectedHuman: (delta: number) => void;
  cycleFocalLength: () => void;
  setFocalLength: (f: FocalLength) => void;
  setRecording: (on: boolean) => void;
  setRecordingMs: (ms: number) => void;
  setRecordingBlob: (blob: Blob | null) => void;

  // 相机
  setCameraPose: (pose: Partial<OrbitCameraPose>) => void;
  setLocked: (locked: boolean) => void;
  setCameraOrientation: (orientation: "landscape" | "portrait") => void;

  // AR
  setARSupported: (supported: boolean | null) => void;
  setARActive: (active: boolean) => void;
  setARError: (error: string | null) => void;

  // 场景库
  setLoadedSceneId: (id: string | null) => void;
  loadSceneState: (state: SceneState, pose: OrbitCameraPose) => void;

  // 重置
  reset: () => void;
}

export const useStudioStore = create<StudioStore>((set) => ({
  mode: "edit",
  humans: [],
  selectedHumanID: null,
  focalLength: 35,
  isRecording: false,
  cameraPose: { ...DEFAULT_CAMERA_POSE },
  locked: false,
  cameraOrientation: "landscape",
  arSupported: null,
  arActive: false,
  arError: null,
  recordingMs: 0,
  recordingBlob: null,
  loadedSceneId: null,

  setMode: (mode) => set({ mode }),

  addHuman: () =>
    set((s) => {
      // 与 iOS 版一致：按 count 偏移放置
      const offset = s.humans.length * 0.6;
      const placement: HumanPlacement = {
        id: uuidv4(),
        position: [offset, 0, 0],
        rotationY: 0,
      };
      return {
        humans: [...s.humans, placement],
        selectedHumanID: placement.id,
      };
    }),

  deleteSelectedHuman: () =>
    set((s) => {
      if (!s.selectedHumanID) return s;
      const humans = s.humans.filter((h) => h.id !== s.selectedHumanID);
      return {
        humans,
        selectedHumanID: humans.length > 0 ? humans[humans.length - 1].id : null,
      };
    }),

  selectHuman: (id) => set({ selectedHumanID: id }),

  updateHumanPosition: (id, position) =>
    set((s) => ({
      humans: s.humans.map((h) => (h.id === id ? { ...h, position } : h)),
    })),

  updateHumanRotation: (id, rotationY) =>
    set((s) => ({
      humans: s.humans.map((h) => (h.id === id ? { ...h, rotationY } : h)),
    })),

  rotateSelectedHuman: (delta) =>
    set((s) => {
      if (!s.selectedHumanID) return s;
      return {
        humans: s.humans.map((h) =>
          h.id === s.selectedHumanID
            ? { ...h, rotationY: h.rotationY + delta }
            : h
        ),
      };
    }),

  cycleFocalLength: () =>
    set((s) => ({ focalLength: nextFocalLength(s.focalLength) })),

  setFocalLength: (f) => set({ focalLength: f }),

  setRecording: (on) => set({ isRecording: on }),
  setRecordingMs: (ms) => set({ recordingMs: ms }),
  setRecordingBlob: (blob) => set({ recordingBlob: blob }),

  setCameraPose: (pose) =>
    set((s) => ({ cameraPose: { ...s.cameraPose, ...pose } })),

  setLocked: (locked) => set({ locked }),

  setCameraOrientation: (orientation) => set({ cameraOrientation: orientation }),

  setARSupported: (supported) => set({ arSupported: supported }),
  setARActive: (active) => set({ arActive: active }),
  setARError: (error) => set({ arError: error }),

  setLoadedSceneId: (id) => set({ loadedSceneId: id }),

  loadSceneState: (state, pose) =>
    set({
      mode: state.mode,
      humans: state.humans,
      selectedHumanID: state.selectedHumanID,
      focalLength: state.focalLength,
      isRecording: false,
      cameraPose: pose,
    }),

  reset: () =>
    set({
      ...DEFAULT_SCENE_STATE,
      cameraPose: { ...DEFAULT_CAMERA_POSE },
      locked: false,
      arActive: false,
      arError: null,
      recordingMs: 0,
      recordingBlob: null,
      loadedSceneId: null,
    }),
}));
