import Foundation
import Vision
import AppKit
// usage: ocr <image> ...   → one JSON line per recognised string: {"file","text","conf","box":[x0,y0,x1,y1]} (normalised, origin top-left)
for path in CommandLine.arguments.dropFirst() {
  guard let img = NSImage(contentsOfFile: path), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate; req.usesLanguageCorrection = false; req.minimumTextHeight = 0.004
  let h = VNImageRequestHandler(cgImage: cg, options: [:])
  try? h.perform([req])
  for o in req.results ?? [] {
    guard let c = o.topCandidates(1).first else { continue }
    let b = o.boundingBox
    let d: [String: Any] = ["file": path, "text": c.string, "conf": c.confidence, "box": [b.minX, 1 - b.maxY, b.maxX, 1 - b.minY]]
    if let j = try? JSONSerialization.data(withJSONObject: d), let s = String(data: j, encoding: .utf8) { print(s) }
  }
}
