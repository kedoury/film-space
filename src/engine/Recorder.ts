// Canvas 录制器：用 canvas.captureStream + MediaRecorder 录制 webm 视频
// 对应 iOS SceneRecorder 的简化版

/** 优先尝试的视频 MIME 类型列表 */
const MIME_CANDIDATES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

/** 选择浏览器支持的第一个 MIME 类型 */
function pickMimeType(): string {
  for (const mime of MIME_CANDIDATES) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return "video/webm";
}

/**
 * Canvas 录制器，对应 iOS SceneRecorder。
 *
 * 用法：
 *   recorder.start(canvas, 30);
 *   ... 渲染循环正常进行 ...
 *   const blob = await recorder.stop();
 */
export class Recorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startTime = 0;
  private _isRecording = false;
  private stream: MediaStream | null = null;

  /** 当前是否正在录制 */
  get isRecording(): boolean {
    return this._isRecording;
  }

  /** 开始录制
   * @param canvas 要录制的 canvas（renderer 的 domElement）
   * @param fps 帧率，默认 30
   */
  start(canvas: HTMLCanvasElement, fps = 30): void {
    if (this._isRecording) return;
    // 捕获 canvas 流；render() / setAnimationLoop 每帧会更新画面
    const stream = canvas.captureStream(fps);
    this.stream = stream;

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 8_000_000, // 8 Mbps，与 iOS 质量近似
    });

    this.chunks = [];
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    this.startTime = performance.now();
    this._isRecording = true;
    this.mediaRecorder = recorder;
    recorder.start();
  }

  /** 停止录制，返回 webm Blob */
  stop(): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      const recorder = this.mediaRecorder;
      if (!recorder || !this._isRecording) {
        reject(new Error("Recorder is not recording"));
        return;
      }
      recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: "video/webm" });
        this._isRecording = false;
        this.mediaRecorder = null;
        // 关闭流轨道
        if (this.stream) {
          this.stream.getTracks().forEach((t) => t.stop());
          this.stream = null;
        }
        resolve(blob);
      };
      recorder.onerror = (e: Event) => {
        this._isRecording = false;
        reject(e);
      };
      recorder.stop();
    });
  }

  /** 已录制时长（毫秒） */
  getDurationMs(): number {
    if (!this._isRecording) return 0;
    return performance.now() - this.startTime;
  }
}

/** 便捷工具：把 Blob 转成 object URL（用于预览/下载） */
export function blobToURL(blob: Blob): string {
  return URL.createObjectURL(blob);
}
