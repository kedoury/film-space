//
//  SceneRecorder.swift
//  film space
//

import AVFoundation
import Photos
import RealityKit
import UIKit

// Records the rendered ARView contents (scene only, no SwiftUI overlay) plus
// microphone audio to a video file and saves it to the photo library.
// Snapshots are taken on the main thread; all encoding happens off-main.
@MainActor
final class SceneRecorder: NSObject {
    private(set) var isRecording = false

    private weak var arView: ARView?
    private let writer = MediaWriter()
    private var displayLink: CADisplayLink?
    private var capturing = false

    private let captureSession = AVCaptureSession()
    private let audioOutput = AVCaptureAudioDataOutput()
    private let audioQueue = DispatchQueue(label: "com.filmspace.audio")
    private var audioConfigured = false

    func start(arView: ARView) {
        guard !isRecording else { return }
        self.arView = arView
        isRecording = true

        let scale = arView.contentScaleFactor
        let pixelWidth = Int(arView.bounds.width * scale)
        let pixelHeight = Int(arView.bounds.height * scale)
        writer.prepare(sourceWidth: pixelWidth, sourceHeight: pixelHeight)

        configureAudioIfNeeded()
        startAudio()

        let link = CADisplayLink(target: self, selector: #selector(captureFrame))
        link.preferredFramesPerSecond = 30
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    func stop() {
        guard isRecording else { return }
        isRecording = false
        displayLink?.invalidate()
        displayLink = nil
        stopAudio()

        writer.finish { url in
            if let url {
                SceneRecorder.saveToPhotos(url)
            }
        }
    }

    @objc private func captureFrame() {
        guard isRecording, !capturing, let arView else { return }
        capturing = true
        arView.snapshot(saveToHDR: false) { [weak self] image in
            MainActor.assumeIsolated {
                guard let self else { return }
                self.capturing = false
                guard self.isRecording, let cgImage = image?.cgImage else { return }
                self.writer.appendVideo(cgImage, hostTimeSeconds: CACurrentMediaTime())
            }
        }
    }

    private func configureAudioIfNeeded() {
        guard !audioConfigured else { return }
        audioConfigured = true

        captureSession.beginConfiguration()
        if let device = AVCaptureDevice.default(for: .audio),
           let input = try? AVCaptureDeviceInput(device: device),
           captureSession.canAddInput(input) {
            captureSession.addInput(input)
        }
        audioOutput.setSampleBufferDelegate(self, queue: audioQueue)
        if captureSession.canAddOutput(audioOutput) {
            captureSession.addOutput(audioOutput)
        }
        captureSession.commitConfiguration()
    }

    private func startAudio() {
        let session = captureSession
        audioQueue.async {
            if !session.isRunning { session.startRunning() }
        }
    }

    private func stopAudio() {
        let session = captureSession
        audioQueue.async {
            if session.isRunning { session.stopRunning() }
        }
    }

    nonisolated private static func saveToPhotos(_ url: URL) {
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else {
                try? FileManager.default.removeItem(at: url)
                return
            }
            PHPhotoLibrary.shared().performChanges {
                PHAssetCreationRequest.creationRequestForAssetFromVideo(atFileURL: url)
            } completionHandler: { _, _ in
                try? FileManager.default.removeItem(at: url)
            }
        }
    }
}

extension SceneRecorder: AVCaptureAudioDataOutputSampleBufferDelegate {
    nonisolated func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        writer.appendAudio(sampleBuffer)
    }
}

// Owns the AVAssetWriter and does all encoding on its own serial queue so the
// main thread (and the RealityKit render loop) stay responsive. Video frames
// and audio samples share the host-time clock so they stay in sync.
private final class MediaWriter: @unchecked Sendable {
    private let queue = DispatchQueue(label: "com.filmspace.mediawriter")
    private let maxLongSide = 1280

    private var writer: AVAssetWriter?
    private var videoInput: AVAssetWriterInput?
    private var audioInput: AVAssetWriterInput?
    private var adaptor: AVAssetWriterInputPixelBufferAdaptor?
    private var url: URL?
    private var size: (width: Int, height: Int)?
    private var sessionStarted = false

    func prepare(sourceWidth: Int, sourceHeight: Int) {
        queue.async { [weak self] in
            self?.setup(sourceWidth: sourceWidth, sourceHeight: sourceHeight)
        }
    }

    func appendVideo(_ cgImage: CGImage, hostTimeSeconds: Double) {
        queue.async { [weak self] in
            guard let self, let writer = self.writer, writer.status == .writing,
                  let videoInput = self.videoInput, let adaptor = self.adaptor,
                  let size = self.size else { return }

            let presentationTime = CMTime(seconds: hostTimeSeconds, preferredTimescale: 1_000_000_000)
            self.startSessionIfNeeded(at: presentationTime)

            guard videoInput.isReadyForMoreMediaData, let pool = adaptor.pixelBufferPool else { return }

            var pixelBufferOut: CVPixelBuffer?
            CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pixelBufferOut)
            guard let pixelBuffer = pixelBufferOut else { return }

            CVPixelBufferLockBaseAddress(pixelBuffer, [])
            if let context = CGContext(
                data: CVPixelBufferGetBaseAddress(pixelBuffer),
                width: size.width,
                height: size.height,
                bitsPerComponent: 8,
                bytesPerRow: CVPixelBufferGetBytesPerRow(pixelBuffer),
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
            ) {
                context.draw(cgImage, in: CGRect(x: 0, y: 0, width: size.width, height: size.height))
            }
            CVPixelBufferUnlockBaseAddress(pixelBuffer, [])

            adaptor.append(pixelBuffer, withPresentationTime: presentationTime)
        }
    }

    func appendAudio(_ sampleBuffer: CMSampleBuffer) {
        queue.async { [weak self] in
            guard let self, let writer = self.writer, writer.status == .writing,
                  let audioInput = self.audioInput else { return }

            let presentationTime = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
            self.startSessionIfNeeded(at: presentationTime)

            guard audioInput.isReadyForMoreMediaData else { return }
            audioInput.append(sampleBuffer)
        }
    }

    func finish(completion: @escaping (URL?) -> Void) {
        queue.async { [weak self] in
            guard let self, let writer = self.writer, writer.status == .writing else {
                completion(nil)
                return
            }
            self.videoInput?.markAsFinished()
            self.audioInput?.markAsFinished()
            let url = self.url
            writer.finishWriting {
                completion(writer.status == .completed ? url : nil)
            }
        }
    }

    private func startSessionIfNeeded(at time: CMTime) {
        guard !sessionStarted, let writer else { return }
        writer.startSession(atSourceTime: time)
        sessionStarted = true
    }

    private func setup(sourceWidth: Int, sourceHeight: Int) {
        let longSide = max(sourceWidth, sourceHeight)
        let scale = longSide > maxLongSide ? Double(maxLongSide) / Double(longSide) : 1
        let width = max(2, Int((Double(sourceWidth) * scale).rounded())) & ~1
        let height = max(2, Int((Double(sourceHeight) * scale).rounded())) & ~1

        let outputURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("film-space-\(UUID().uuidString).mov")
        guard let writer = try? AVAssetWriter(url: outputURL, fileType: .mov) else { return }

        let videoSettings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height
        ]
        let videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
        videoInput.expectsMediaDataInRealTime = true

        let attributes: [String: Any] = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: width,
            kCVPixelBufferHeightKey as String: height
        ]
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: videoInput,
            sourcePixelBufferAttributes: attributes
        )

        let audioSettings: [String: Any] = [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVNumberOfChannelsKey: 1,
            AVSampleRateKey: 44_100,
            AVEncoderBitRateKey: 64_000
        ]
        let audioInput = AVAssetWriterInput(mediaType: .audio, outputSettings: audioSettings)
        audioInput.expectsMediaDataInRealTime = true

        guard writer.canAdd(videoInput) else { return }
        writer.add(videoInput)
        if writer.canAdd(audioInput) {
            writer.add(audioInput)
            self.audioInput = audioInput
        }

        guard writer.startWriting() else { return }

        self.writer = writer
        self.videoInput = videoInput
        self.adaptor = adaptor
        self.url = outputURL
        self.size = (width, height)
    }
}
