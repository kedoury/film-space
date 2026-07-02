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
                entity.orientation = placement.orientation
                if entity.components[HumanSelectionComponent.self]?.isSelected != isSelected {
                    entity.removeFromParent()
                    let replacement = HumanFigureFactory.makeHumanFigure(isSelected: isSelected)
                    replacement.position = placement.position
                    replacement.orientation = placement.orientation
                    replacement.components.set(HumanTagComponent(id: placement.id))
                    replacement.components.set(HumanSelectionComponent(isSelected: isSelected))
                    root.addChild(replacement)
                }
            } else {
                let entity = HumanFigureFactory.makeHumanFigure(isSelected: isSelected)
                entity.position = placement.position
                entity.orientation = placement.orientation
                entity.components.set(HumanTagComponent(id: placement.id))
                entity.components.set(HumanSelectionComponent(isSelected: isSelected))
                root.addChild(entity)
            }
        }
    }
}

extension SceneContentBuilder {
    static func syncBoxes(
        objects: [BoxObject],
        selectedID: UUID?,
        selectedFace: BoxFace?,
        into root: Entity
    ) {
        let existing = Dictionary(uniqueKeysWithValues: root.children.compactMap { child -> (UUID, Entity)? in
            guard child.name == "BoxObject", let id = child.components[BoxTagComponent.self]?.id else { return nil }
            return (id, child)
        })

        let objectIDs = Set(objects.map(\.id))
        for (id, entity) in existing where !objectIDs.contains(id) {
            entity.removeFromParent()
        }

        for box in objects {
            let isSelected = box.id == selectedID
            let face = isSelected ? selectedFace : nil
            if let entity = existing[box.id] {
                BoxFigureFactory.update(entity, box: box, isSelected: isSelected, selectedFace: face)
            } else {
                let entity = BoxFigureFactory.makeBox(box, isSelected: isSelected, selectedFace: face)
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

struct BoxTagComponent: Component {
    var id: UUID
}

struct BoxSelectionComponent: Component {
    var isSelected: Bool
    var selectedFace: BoxFace?
}

struct HandleTagComponent: Component {
    var boxID: UUID
    var face: BoxFace
}
