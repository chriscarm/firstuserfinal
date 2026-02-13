// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FirstUserSDK",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "FirstUserSDK", targets: ["FirstUserSDK"])
    ],
    targets: [
        .target(name: "FirstUserSDK", path: "Sources")
    ]
)
