//
//  SceneContentBuilder.swift
//  film space
//

import Foundation
import RealityKit

enum SceneContentBuilder {
    static func syncHumans(
        placements: [HumanPlacement],
        selectedID: UUID?,
        into root: Entity
    ) {
        let existing = Dictionary(uniqueKeysWithValues: root.children.compactMap { child -> (UUID, Entity)? in
            guard child.name == "HumanFigure", let idString = child.components[HumanTagComponent.self]?.id else { return nil }
            return (idString, child)
        })

        let placementIDs = Set(placements.map(\.id))

        for (id, entity) in existing where !placementIDs.contains(id) {
            entity.removeFromParent()
        }

        for placement in placements {
            let isSelected = placement.id == selectedID
            if let entity = existing[placement.id] {
                entity.position = placement.position
                entity.orientation = simd_quatf(angle: placement.rotationY, axis: [0, 1, 0])
                if entity.components[HumanSelectionComponent.self]?.isSelected != isSelected {
                    entity.removeFromParent()
                    let replacement = HumanFigureFactory.makeHumanFigure(isSelected: isSelected)
                    replacement.position = placement.position
                    replacement.orientation = simd_quatf(angle: placement.rotationY, axis: [0, 1, 0])
                    replacement.components.set(HumanTagComponent(id: placement.id))
                    replacement.components.set(HumanSelectionComponent(isSelected: isSelected))
                    root.addChild(replacement)
                }
            } else {
                let entity = HumanFigureFactory.makeHumanFigure(isSelected: isSelected)
                entity.position = placement.position
                entity.orientation = simd_quatf(angle: placement.rotationY, axis: [0, 1, 0])
                entity.components.set(HumanTagComponent(id: placement.id))
                entity.components.set(HumanSelectionComponent(isSelected: isSelected))
                root.addChild(entity)
            }
        }
    }
}

struct HumanTagComponent: Component {
    var id: UUID
}

struct HumanSelectionComponent: Component {
    var isSelected: Bool
}
