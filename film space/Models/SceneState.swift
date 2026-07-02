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
    /// Pitch (vertical rotation) about the local X axis.
    var rotationX: Float

    init(id: UUID = UUID(), position: SIMD3<Float> = [0, 0, 0], rotationY: Float = 0, rotationX: Float = 0) {
        self.id = id
        self.position = position
        self.rotationY = rotationY
        self.rotationX = rotationX
    }

    var orientation: simd_quatf {
        simd_quatf(angle: rotationY, axis: [0, 1, 0]) * simd_quatf(angle: rotationX, axis: [1, 0, 0])
    }
}

/// One of the six faces of a box, used as a resize handle target.
enum BoxFace: Equatable, CaseIterable {
    case positiveX, negativeX
    case positiveY, negativeY
    case positiveZ, negativeZ

    /// Outward-pointing unit normal in the box's local (unrotated) space.
    var localNormal: SIMD3<Float> {
        switch self {
        case .positiveX: return [1, 0, 0]
        case .negativeX: return [-1, 0, 0]
        case .positiveY: return [0, 1, 0]
        case .negativeY: return [0, -1, 0]
        case .positiveZ: return [0, 0, 1]
        case .negativeZ: return [0, 0, -1]
        }
    }

    /// Which size component this face resizes: 0 = x, 1 = y, 2 = z.
    var axis: Int {
        switch self {
        case .positiveX, .negativeX: return 0
        case .positiveY, .negativeY: return 1
        case .positiveZ, .negativeZ: return 2
        }
    }

    var isVertical: Bool { self == .positiveY || self == .negativeY }
}

struct BoxObject: Identifiable, Equatable {
    let id: UUID
    /// World-space center of the box.
    var position: SIMD3<Float>
    /// Full extents along the box's local x/y/z axes.
    var size: SIMD3<Float>
    var rotationY: Float
    /// Pitch (vertical rotation) about the local X axis.
    var rotationX: Float

    init(
        id: UUID = UUID(),
        position: SIMD3<Float> = [0, 0.25, 0],
        size: SIMD3<Float> = [0.5, 0.5, 0.5],
        rotationY: Float = 0,
        rotationX: Float = 0
    ) {
        self.id = id
        self.position = position
        self.size = size
        self.rotationY = rotationY
        self.rotationX = rotationX
    }

    var orientation: simd_quatf {
        simd_quatf(angle: rotationY, axis: [0, 1, 0]) * simd_quatf(angle: rotationX, axis: [1, 0, 0])
    }
}

@Observable
final class SceneState {
    var mode: AppMode = .edit
    var humans: [HumanPlacement] = []
    var selectedHumanID: UUID?
    var boxes: [BoxObject] = []
    var selectedBoxID: UUID?
    /// The face currently armed for resizing on the selected box.
    var selectedFace: BoxFace?
    var focalLength: FocalLength = .mm35
    var isRecording = false

    /// Smallest allowed extent for a box along any axis.
    static let minBoxExtent: Float = 0.05

    func cycleFocalLength() {
        focalLength = focalLength.next
    }

    var hasSelection: Bool {
        selectedHumanID != nil || selectedBoxID != nil
    }

    // MARK: - Humans

    var selectedHuman: HumanPlacement? {
        guard let id = selectedHumanID else { return nil }
        return humans.first { $0.id == id }
    }

    func addHuman() {
        let offset = Float(humans.count) * 0.6
        let placement = HumanPlacement(position: [offset, 0, 0])
        humans.append(placement)
        selectHuman(id: placement.id)
    }

    func selectHuman(id: UUID?) {
        selectedHumanID = id
        if id != nil {
            selectedBoxID = nil
            selectedFace = nil
        }
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

    // MARK: - Boxes

    var selectedBox: BoxObject? {
        guard let id = selectedBoxID else { return nil }
        return boxes.first { $0.id == id }
    }

    func addBox() {
        let offset = Float(boxes.count) * 0.7
        let box = BoxObject(position: [offset, 0.25, 0])
        boxes.append(box)
        selectBox(id: box.id)
    }

    func selectBox(id: UUID?) {
        selectedBoxID = id
        selectedFace = nil
        if id != nil {
            selectedHumanID = nil
        }
    }

    func selectFace(_ face: BoxFace?) {
        guard selectedBoxID != nil else { return }
        // Toggle off if the same face is tapped again.
        selectedFace = (selectedFace == face) ? nil : face
    }

    func updateBox(id: UUID, position: SIMD3<Float>, size: SIMD3<Float>) {
        guard let index = boxes.firstIndex(where: { $0.id == id }) else { return }
        boxes[index].position = position
        boxes[index].size = size
    }

    func rotateSelectedBox(by delta: Float) {
        guard let id = selectedBoxID,
              let index = boxes.firstIndex(where: { $0.id == id }) else { return }
        boxes[index].rotationY += delta
    }

    // MARK: - Shared selection actions

    func deselectAll() {
        selectedHumanID = nil
        selectedBoxID = nil
        selectedFace = nil
    }

    func deleteSelected() {
        if let id = selectedBoxID {
            boxes.removeAll { $0.id == id }
            selectedBoxID = nil
            selectedFace = nil
            return
        }
        if let id = selectedHumanID {
            humans.removeAll { $0.id == id }
            selectedHumanID = humans.last?.id
        }
    }

    func rotateSelected(by delta: Float) {
        if selectedBoxID != nil {
            rotateSelectedBox(by: delta)
        } else if selectedHumanID != nil {
            rotateSelectedHuman(by: delta)
        }
    }

    /// Tilts the selected object about its local X axis (vertical rotation).
    func pitchSelected(by delta: Float) {
        if let id = selectedBoxID, let index = boxes.firstIndex(where: { $0.id == id }) {
            boxes[index].rotationX += delta
        } else if let id = selectedHumanID, let index = humans.firstIndex(where: { $0.id == id }) {
            humans[index].rotationX += delta
        }
    }

    /// Raises/lowers the selected object, keeping it from sinking below the ground.
    func liftSelected(by delta: Float) {
        if let id = selectedBoxID, let index = boxes.firstIndex(where: { $0.id == id }) {
            boxes[index].position.y = max(boxes[index].size.y / 2, boxes[index].position.y + delta)
        } else if let id = selectedHumanID, let index = humans.firstIndex(where: { $0.id == id }) {
            humans[index].position.y = max(0, humans[index].position.y + delta)
        }
    }
}
