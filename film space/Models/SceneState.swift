//
//  SceneState.swift
//  film space
//

import Foundation
import RealityKit

enum AppMode: String, CaseIterable {
    case edit = "Edit"
    case camera = "Camera"
}

enum FocalLength: Float, CaseIterable {
    case mm35 = 35
    case mm50 = 50
    case mm75 = 75
    case mm200 = 200

    var label: String { "\(Int(rawValue))mm" }

    var next: FocalLength {
        let all = FocalLength.allCases
        let index = all.firstIndex(of: self) ?? 0
        return all[(index + 1) % all.count]
    }

    /// Horizontal field of view for a full-frame (36mm wide) sensor.
    var horizontalFOVDegrees: Float {
        let sensorWidth: Float = 36
        return 2 * atan(sensorWidth / (2 * rawValue)) * 180 / .pi
    }
}

struct HumanPlacement: Identifiable, Equatable {
    let id: UUID
    var position: SIMD3<Float>
    var rotationY: Float

    init(id: UUID = UUID(), position: SIMD3<Float> = [0, 0, 0], rotationY: Float = 0) {
        self.id = id
        self.position = position
        self.rotationY = rotationY
    }
}

@Observable
final class SceneState {
    var mode: AppMode = .edit
    var humans: [HumanPlacement] = []
    var selectedHumanID: UUID?
    var focalLength: FocalLength = .mm35
    var isRecording = false

    func cycleFocalLength() {
        focalLength = focalLength.next
    }

    var selectedHuman: HumanPlacement? {
        guard let id = selectedHumanID else { return nil }
        return humans.first { $0.id == id }
    }

    func addHuman() {
        let offset = Float(humans.count) * 0.6
        let placement = HumanPlacement(position: [offset, 0, 0])
        humans.append(placement)
        selectedHumanID = placement.id
    }

    func deleteSelectedHuman() {
        guard let id = selectedHumanID else { return }
        humans.removeAll { $0.id == id }
        selectedHumanID = humans.last?.id
    }

    func selectHuman(id: UUID?) {
        selectedHumanID = id
    }

    func updateHumanPosition(id: UUID, position: SIMD3<Float>) {
        guard let index = humans.firstIndex(where: { $0.id == id }) else { return }
        humans[index].position = position
    }

    func updateHumanRotation(id: UUID, rotationY: Float) {
        guard let index = humans.firstIndex(where: { $0.id == id }) else { return }
        humans[index].rotationY = rotationY
    }

    func rotateSelectedHuman(by delta: Float) {
        guard let id = selectedHumanID,
              let index = humans.firstIndex(where: { $0.id == id }) else { return }
        humans[index].rotationY += delta
    }
}
