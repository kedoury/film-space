// 分享查看页
// URL: /share/:type/:token
// scene: 显示场景配置 + 缩略图 + "复制到工作台"按钮
// video: 内嵌 <video controls>

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Download,
  AlertCircle,
  Loader2,
  Film,
  Folder,
  Copy,
  Check,
} from "lucide-react";
import type { SceneMeta, VideoMeta } from "@shared/types";
import { api, downloadBlob } from "@/api/client";
import { useStudioStore } from "@/store/sceneStore";

export function SharePage() {
  const { type, token } = useParams<{ type: string; token: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scene, setScene] = useState<SceneMeta | null>(null);
  const [video, setVideo] = useState<VideoMeta | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token || !type) return;
    setLoading(true);
    setError(null);
    const fetcher =
      type === "scene"
        ? api.getShareScene(token)
        : type === "video"
          ? api.getShareVideo(token)
          : Promise.reject(new Error("未知的分享类型"));
    fetcher
      .then((data) => {
        if (type === "scene") setScene(data as SceneMeta);
        else setVideo(data as VideoMeta);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [type, token]);

  const handleCopyToStudio = () => {
    if (!scene) return;
    useStudioStore.getState().loadSceneState(scene.state, scene.cameraPose);
    useStudioStore.getState().setLoadedSceneId(null);
    setCopied(true);
    setTimeout(() => navigate("/studio"), 600);
  };

  const handleDownload = async () => {
    if (!video) return;
    try {
      const res = await fetch(api.videoFileURL(video.id));
      const blob = await res.blob();
      downloadBlob(blob, `${video.name}.webm`);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed inset-0 bg-studio-black overflow-y-auto studio-scroll">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-10 glass-panel border-b border-studio-border">
        <div className="flex items-center gap-3 px-6 py-4">
          <button
            onClick={() => navigate("/studio")}
            className="w-9 h-9 rounded-full glass-button flex items-center justify-center text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-display font-bold text-white flex items-center gap-2">
            {type === "video" ? (
              <Film className="w-5 h-5 text-accent-film" />
            ) : (
              <Folder className="w-5 h-5 text-accent-film" />
            )}
            分享{type === "video" ? "视频" : "场景"}
          </h1>
        </div>
      </div>

      <div className="p-6 flex justify-center">
        {/* 加载骨架 */}
        {loading && (
          <div className="flex flex-col items-center py-20">
            <Loader2 className="w-8 h-8 text-accent-film animate-spin mb-4" />
            <p className="text-studio-light">加载中...</p>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="flex flex-col items-center py-20">
            <AlertCircle className="w-12 h-12 text-status-rec mb-4" />
            <p className="text-status-rec font-semibold mb-2">加载失败</p>
            <p className="text-studio-light text-sm">{error}</p>
          </div>
        )}

        {/* 场景分享 */}
        {scene && !loading && !error && (
          <div className="max-w-2xl w-full">
            <div className="glass-panel rounded-2xl overflow-hidden">
              {/* 缩略图 */}
              <div className="aspect-video bg-studio-dark">
                <img
                  src={scene.thumbnailURL}
                  alt={scene.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6">
                <h2 className="text-2xl font-display font-bold text-white mb-4">
                  {scene.name}
                </h2>
                {/* 场景配置 */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-3 rounded-lg bg-studio-panel/80">
                    <div className="text-xs text-studio-light">人形数量</div>
                    <div className="text-xl font-mono text-white">
                      {scene.state.humans.length}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-studio-panel/80">
                    <div className="text-xs text-studio-light">焦段</div>
                    <div className="text-xl font-mono text-white">
                      {scene.state.focalLength}mm
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-studio-panel/80">
                    <div className="text-xs text-studio-light">模式</div>
                    <div className="text-xl font-mono text-white">
                      {scene.state.mode === "edit" ? "编辑" : "相机"}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleCopyToStudio}
                  className="w-full py-3 rounded-lg bg-accent-film text-studio-black font-semibold flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition"
                >
                  <Copy className="w-4 h-4" />
                  复制到工作台
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 视频分享 */}
        {video && !loading && !error && (
          <div className="max-w-3xl w-full">
            <div className="glass-panel rounded-2xl overflow-hidden">
              <video
                src={video.fileURL}
                controls
                autoPlay
                className="w-full bg-black"
                playsInline
              />
              <div className="p-6">
                <h2 className="text-2xl font-display font-bold text-white mb-2">
                  {video.name}
                </h2>
                <p className="text-sm text-studio-light mb-4">
                  {Math.floor(video.durationMs / 1000)} 秒 ·{" "}
                  {video.width}×{video.height}
                </p>
                <button
                  onClick={handleDownload}
                  className="px-6 py-2.5 rounded-lg glass-button text-white font-semibold flex items-center gap-2 hover:brightness-110 active:scale-95 transition"
                >
                  <Download className="w-4 h-4" />
                  下载视频
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 已复制标记（不在视图内，仅为状态占位） */}
      {copied && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-status-ok/20 text-status-ok text-sm font-semibold flex items-center gap-2">
          <Check className="w-4 h-4" />
          已复制到工作台
        </div>
      )}
    </div>
  );
}
