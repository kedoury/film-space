// Studio 引擎上下文：通过 React Context 暴露 SceneManager 引用
// 供 StudioToolbar 等组件直接调用引擎方法（轨道移动、Lock、AR 等）

import { createContext, useContext } from "react";
import type { SceneManager } from "@/engine/SceneManager";

export interface StudioContextValue {
  manager: SceneManager | null;
}

export const StudioContext = createContext<StudioContextValue | null>(null);

/** 获取当前 SceneManager 引用（可能为 null，首次渲染前未就绪） */
export function useSceneManager(): StudioContextValue | null {
  return useContext(StudioContext);
}
