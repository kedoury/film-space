//
//  BoxFigureFactory.swift
//  film space
//

import RealityKit
import UIKit

/// Builds and updates the resizable box objects and their face handles.
enum BoxFigureFactory {
    static let handleRadius: Float = 0.06
    /// Collision radius is larger than the visible dot so it's easier to tap.
    static let handleHitRadius: Float = 0.14

    private static let bodyColor = UIColor(red: 0.62, green: 0.64, blue: 0.68, alpha: 1)
    private static let selectedBodyColor = UIColor(red: 0.30, green: 0.55, blue: 0.95, alpha: 1)
    private static let handleColor = UIColor(red: 0.98, green: 0.82, blue: 0.15, alpha: 1)
    private static let activeHandleColor = UIColor(red: 1.0, green: 0.45, blue: 0.10, alpha: 1)

    /// Creates a fully configured box entity for the given model.
    static func makeBox(_ box: BoxObject, isSelected: Bool, selectedFace: BoxFace?) -> Entity {
        let root = Entity()
        root.name = "BoxObject"

        let mesh = ModelEntity(mesh: .generateBox(size: 1))
        mesh.name = "BoxMesh"
        root.addChild(mesh)

        update(root, box: box, isSelected: isSelected, selectedFace: selectedFace)
        return root
    }

    /// Reconfigures an existing box entity in place to match the model.
    static func update(_ root: Entity, box: BoxObject, isSelected: Bool, selectedFace: BoxFace?) {
        root.position = box.position
        root.orientation = box.orientation
        root.components.set(BoxTagComponent(id: box.id))
        root.components.set(BoxSelectionComponent(isSelected: isSelected, selectedFace: selectedFace))
        root.components.set(InputTargetComponent())
        root.components.set(CollisionComponent(shapes: [.generateBox(size: box.size)]))

        if let mesh = root.findEntity(named: "BoxMesh") as? ModelEntity {
            mesh.scale = box.size
            let color = isSelected ? selectedBodyColor : bodyColor
            mesh.model?.materials = [SimpleMaterial(color: color, roughness: 0.5, isMetallic: false)]
        }

        syncHandles(on: root, box: box, isSelected: isSelected, selectedFace: selectedFace)
    }

    private static func syncHandles(on root: Entity, box: BoxObject, isSelected: Bool, selectedFace: BoxFace?) {
        let existingHandles = root.children.filter { $0.name == "BoxHandle" }

        guard isSelected else {
            existingHandles.forEach { $0.removeFromParent() }
            return
        }

        var handlesByFace = Dictionary(uniqueKeysWithValues: existingHandles.compactMap { child -> (BoxFace, Entity)? in
            guard let tag = child.components[HandleTagComponent.self] else { return nil }
            return (tag.face, child)
        })

        for face in BoxFace.allCases {
            let handle = handlesByFace[face] ?? makeHandle(boxID: box.id, face: face, parent: root)
            handlesByFace[face] = handle

            let normal = face.localNormal
            handle.position = SIMD3(
                normal.x * box.size.x / 2,
                normal.y * box.size.y / 2,
                normal.z * box.size.z / 2
            )

            let isActive = (face == selectedFace)
            if let model = handle as? ModelEntity {
                let color = isActive ? activeHandleColor : handleColor
                model.model?.materials = [UnlitMaterial(color: color)]
                // Grow the armed handle a touch so the selected side reads clearly.
                model.scale = isActive ? SIMD3(repeating: 1.4) : .one
            }
        }
    }

    private static func makeHandle(boxID: UUID, face: BoxFace, parent: Entity) -> ModelEntity {
        let handle = ModelEntity(mesh: .generateSphere(radius: handleRadius))
        handle.name = "BoxHandle"
        handle.components.set(HandleTagComponent(boxID: boxID, face: face))
        handle.components.set(InputTargetComponent())
        handle.components.set(CollisionComponent(shapes: [.generateSphere(radius: handleHitRadius)]))
        parent.addChild(handle)
        return handle
    }
}
