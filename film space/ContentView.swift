//
//  ContentView.swift
//  film space
//

import SwiftUI

struct ContentView: View {
    @State private var sceneState = SceneState()
    @State private var cameraController = OrbitCameraController()

    var body: some View {
        ZStack {
            Group {
                switch sceneState.mode {
                case .edit:
                    VirtualStudioView(sceneState: sceneState, cameraController: cameraController)
                case .camera:
                    ARCameraView(sceneState: sceneState, cameraController: cameraController)
                }
            }
            .ignoresSafeArea()

            VStack {
                Spacer()
                StudioToolbar(sceneState: sceneState, cameraController: cameraController)
                    .padding(.bottom, 16)
            }
        }
    }
}

#Preview {
    ContentView()
}
