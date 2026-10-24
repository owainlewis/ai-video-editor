// Person mattes for a folder of frames, with Apple's Vision person segmentation (accurate).
// Usage: matte <frames dir> <masks dir>. Compiled and cached by media/matte.ts.
import Foundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
let inDir = URL(fileURLWithPath: args[1]), outDir = URL(fileURLWithPath: args[2])
let files = try FileManager.default.contentsOfDirectory(atPath: inDir.path).filter { $0.hasSuffix(".png") }.sorted()
let ctx = CIContext()
let request = VNGeneratePersonSegmentationRequest()
request.qualityLevel = .accurate
request.outputPixelFormat = kCVPixelFormatType_OneComponent8
for name in files {
  let url = inDir.appendingPathComponent(name)
  guard let src = CGImageSourceCreateWithURL(url as CFURL, nil), let image = CGImageSourceCreateImageAtIndex(src, 0, nil) else { continue }
  let handler = VNImageRequestHandler(cgImage: image, options: [:])
  try handler.perform([request])
  guard let mask = request.results?.first?.pixelBuffer else { continue }
  var m = CIImage(cvPixelBuffer: mask)
  m = m.transformed(by: CGAffineTransform(scaleX: CGFloat(image.width) / m.extent.width, y: CGFloat(image.height) / m.extent.height))
  guard let out = ctx.createCGImage(m, from: CGRect(x: 0, y: 0, width: image.width, height: image.height), format: .L8, colorSpace: CGColorSpaceCreateDeviceGray()) else { continue }
  let dest = CGImageDestinationCreateWithURL(outDir.appendingPathComponent(name) as CFURL, UTType.png.identifier as CFString, 1, nil)!
  CGImageDestinationAddImage(dest, out, nil)
  CGImageDestinationFinalize(dest)
}
print("masks: \(files.count)")
