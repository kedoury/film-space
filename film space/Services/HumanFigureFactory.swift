//
//  HumanFigureFactory.swift
//  film space
//

import RealityKit
import UIKit

enum HumanFigureFactory {
    private static let skinColor = UIColor(red: 0.76, green: 0.60, blue: 0.42, alpha: 1)
    private static let clothingColor = UIColor(red: 0.35, green: 0.38, blue: 0.45, alpha: 1)

    static func makeHumanFigure(isSelected: Bool) -> Entity {
        let root = Entity()
        root.name = "HumanFigure"

        let skin = SimpleMaterial(color: skinColor, roughness: 0.6, isMetallic: false)
        let clothing = SimpleMaterial(
            color: isSelected ? UIColor.systemBlue : clothingColor,
            roughness: 0.5,
            isMetallic: false
        )

        // ~1.75 m tall figure, feet at y = 0
        addPart(to: root, mesh: .generateSphere(radius: 0.11), material: skin, position: [0, 1.62, 0])
        addPart(to: root, mesh: .generateBox(size: [0.36, 0.48, 0.18]), material: clothing, position: [0, 1.22, 0])

        addPart(to: root, mesh: .generateBox(size: [0.11, 0.38, 0.11]), material: clothing, position: [-0.24, 1.28, 0], rotation: [0, 0, 0.35])
        addPart(to: root, mesh: .generateBox(size: [0.11, 0.38, 0.11]), material: clothing, position: [0.24, 1.28, 0], rotation: [0, 0, -0.35])

        addPart(to: root, mesh: .generateBox(size: [0.09, 0.34, 0.09]), material: skin, position: [-0.38, 1.08, 0], rotation: [0, 0, 0.15])
        addPart(to: root, mesh: .generateBox(size: [0.09, 0.34, 0.09]), material: skin, position: [0.38, 1.08, 0], rotation: [0, 0, -0.15])

        addPart(to: root, mesh: .generateBox(size: [0.13, 0.82, 0.13]), material: clothing, position: [-0.11, 0.58, 0])
        addPart(to: root, mesh: .generateBox(size: [0.13, 0.82, 0.13]), material: clothing, position: [0.11, 0.58, 0])

        addPart(to: root, mesh: .generateBox(size: [0.14, 0.08, 0.24]), material: skin, position: [-0.11, 0.04, 0.02])
        addPart(to: root, mesh: .generateBox(size: [0.14, 0.08, 0.24]), material: skin, position: [0.11, 0.04, 0.02])

        let bounds = root.visualBounds(relativeTo: nil)
        let collisionHeight = bounds.max.y - bounds.min.y
        root.components.set(CollisionComponent(shapes: [.generateBox(size: [0.44, collisionHeight, 0.28])]))
        root.components.set(InputTargetComponent())

        return root
    }

    private static func addPart(
        to parent: Entity,
        mesh: MeshResource,
        material: SimpleMaterial,
        position: SIMD3<Float>,
        rotation: SIMD3<Float> = .zero
    ) {
        let entity = ModelEntity(mesh: mesh, materials: [material])
        entity.position = position
        entity.orientation = simd_quatf(angle: rotation.z, axis: [0, 0, 1])
            * simd_quatf(angle: rotation.y, axis: [0, 1, 0])
            * simd_quatf(angle: rotation.x, axis: [1, 0, 0])
        parent.addChild(entity)
    }
}
