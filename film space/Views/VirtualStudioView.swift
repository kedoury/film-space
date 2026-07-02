//
//  VirtualStudioView.swift
//  film space
//

import SwiftUI
import RealityKit

struct VirtualStudioView: View {
    @Bindable var sceneState: SceneState
    @Bindable var cameraController: OrbitCameraController

    @State private var studioRoot: Entity?
    @State private var lastMagnification: CGFloat = 1
    @State private var lastDragTranslation: CGSize = .zero
    @State private var dragStartPosition: SIMD3<Float>?
    @State private var resizeStartCenter: SIMD3<Float>?
    @State private var resizeStartSize: SIMD3<Float>?

    var body: some View {
        // Read observable state here so SwiftUI tracks these as dependencies of
        // `body`; otherwise the RealityView `update:` closure won't re-run when
        // objects are added/removed/selected.
        let humans = sceneState.humans
        let selectedID = sceneState.selectedHumanID
        let boxes = sceneState.boxes
        let selectedBoxID = sceneState.selectedBoxID
        let selectedFace = sceneState.selectedFace

        RealityView { content in
            content.add(cameraController.makeCameraEntity())

            let root = SceneEnvironment.makeStudioRoot()
            content.add(root)
            studioRoot = root

            SceneContentBuilder.syncHumans(placements: humans, selectedID: selectedID, into: root)
            SceneContentBuilder.syncBoxes(objects: boxes, selectedID: selectedBoxID, selectedFace: selectedFace, into: root)
        } update: { _ in
            guard let root = studioRoot else { return }
            SceneContentBuilder.syncHumans(placements: humans, selectedID: selectedID, into: root)
            SceneContentBuilder.syncBoxes(objects: boxes, selectedID: selectedBoxID, selectedFace: selectedFace, into: root)
        }
        .gesture(navigationDragGesture)
        .simultaneousGesture(zoomGesture)
        .highPriorityGesture(selectGesture)
        .gesture(deselectGesture)
        .background(Color(SceneEnvironment.studioGrey))
    }

    private var navigationDragGesture: some Gesture {
        DragGesture(minimumDistance: 2)
            .onChanged { value in
                let delta = CGSize(
                    width: value.translation.width - lastDragTranslation.width,
                    height: value.translation.height - lastDragTranslation.height
                )
                lastDragTranslation = value.translation

                if sceneState.selectedBoxID != nil, sceneState.selectedFace != nil {
                    resizeSelectedBox(translation: value.translation)
                } else if let id = sceneState.selectedBoxID {
                    moveBox(id: id, translation: value.translation)
                } else if let id = sceneState.selectedHumanID {
                    moveHuman(id: id, translation: value.translation)
                } else {
                    let deltaAzimuth = Float(delta.width) * 0.005
                    let deltaElevation = Float(delta.height) * 0.005
                    cameraController.orbit(deltaAzimuth: deltaAzimuth, deltaElevation: -deltaElevation)
                }
            }
            .onEnded { _ in
                lastDragTranslation = .zero
                dragStartPosition = nil
                resizeStartCenter = nil
                resizeStartSize = nil
            }
    }

    /// Ground-plane displacement produced by a screen drag, matching the feel of
    /// orbit-relative movement.
    private func groundMovement(_ translation: CGSize) -> SIMD3<Float> {
        let moveScale = cameraController.distance * 0.0012
        let azimuth = cameraController.azimuth
        let right = SIMD3<Float>(cos(azimuth), 0, -sin(azimuth))
        let forward = SIMD3<Float>(sin(azimuth), 0, cos(azimuth))
        return right * Float(translation.width) * moveScale
            + forward * Float(translation.height) * moveScale
    }

    private func moveHuman(id: UUID, translation: CGSize) {
        if dragStartPosition == nil {
            dragStartPosition = sceneState.humans.first(where: { $0.id == id })?.position
        }
        guard let start = dragStartPosition else { return }
        var newPosition = start + groundMovement(translation)
        newPosition.y = start.y
        sceneState.updateHumanPosition(id: id, position: newPosition)
    }

    private func moveBox(id: UUID, translation: CGSize) {
        guard let box = sceneState.boxes.first(where: { $0.id == id }) else { return }
        if dragStartPosition == nil {
            dragStartPosition = box.position
        }
        guard let start = dragStartPosition else { return }
        var newPosition = start + groundMovement(translation)
        // Keep the box resting on (or above) the ground.
        newPosition.y = max(start.y, box.size.y / 2)
        sceneState.updateBox(id: id, position: newPosition, size: box.size)
    }

    private func resizeSelectedBox(translation: CGSize) {
        guard let id = sceneState.selectedBoxID,
              let face = sceneState.selectedFace,
              let box = sceneState.boxes.first(where: { $0.id == id }) else { return }

        if resizeStartCenter == nil || resizeStartSize == nil {
            resizeStartCenter = box.position
            resizeStartSize = box.size
        }
        guard let startCenter = resizeStartCenter, let startSize = resizeStartSize else { return }

        // Outward normal of the dragged face in world space (accounts for rotation).
        let worldNormal = box.orientation.act(face.localNormal)

        // Map the screen drag to a world movement, then take the component along
        // the face normal so dragging outward grows the box and inward shrinks it.
        let movement: SIMD3<Float>
        if face.isVertical {
            let scale = cameraController.distance * 0.0012
            movement = SIMD3<Float>(0, -Float(translation.height) * scale, 0)
        } else {
            movement = groundMovement(translation)
        }
        let signedDistance = simd_dot(movement, worldNormal)

        let axis = face.axis
        var newSize = startSize
        newSize[axis] = max(SceneState.minBoxExtent, startSize[axis] + signedDistance)
        let actualDelta = newSize[axis] - startSize[axis]

        // Shift the center by half the growth so the opposite face stays put.
        var newCenter = startCenter + worldNormal * (actualDelta / 2)
        // Never let the box sink below the ground plane.
        newCenter.y = max(newCenter.y, newSize.y / 2)

        sceneState.updateBox(id: id, position: newCenter, size: newSize)
    }

    private var zoomGesture: some Gesture {
        MagnificationGesture()
            .onChanged { scale in
                let delta = Float(scale / lastMagnification)
                cameraController.zoom(scale: delta)
                lastMagnification = scale
            }
            .onEnded { _ in
                lastMagnification = 1
            }
    }

    // Fires when an interactive entity is tapped. High priority so it wins over
    // the deselect tap. Resolves handles first, then boxes, then human figures.
    private var selectGesture: some Gesture {
        SpatialTapGesture()
            .targetedToAnyEntity()
            .onEnded { value in
                if let handle = handleTag(for: value.entity) {
                    sceneState.selectBox(id: handle.boxID)
                    sceneState.selectFace(handle.face)
                } else if let box = boxTag(for: value.entity) {
                    sceneState.selectBox(id: box.id)
                } else if let human = humanTag(for: value.entity) {
                    sceneState.selectHuman(id: human.id)
                }
            }
    }

    // Fires when the tap doesn't hit an entity (empty space, grid, axes), letting
    // you deselect and return to orbiting the canvas.
    private var deselectGesture: some Gesture {
        TapGesture()
            .onEnded {
                sceneState.deselectAll()
            }
    }

    private func humanTag(for entity: Entity) -> HumanTagComponent? {
        component(HumanTagComponent.self, from: entity)
    }

    private func boxTag(for entity: Entity) -> BoxTagComponent? {
        component(BoxTagComponent.self, from: entity)
    }

    private func handleTag(for entity: Entity) -> HandleTagComponent? {
        component(HandleTagComponent.self, from: entity)
    }

    private func component<T: Component>(_ type: T.Type, from entity: Entity) -> T? {
        var current: Entity? = entity
        while let node = current {
            if let value = node.components[type] {
                return value
            }
            current = node.parent
        }
        return nil
    }
}
