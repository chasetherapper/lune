import XCTest
@testable import ArdiaImportCore

final class ReviewRegressionTests: XCTestCase {
  func testMalformedFirefoxOriginAttributesDoNotTrap() {
    XCTAssertTrue(Firefox.originAttributes("^=").isolated)
    XCTAssertTrue(Firefox.originAttributes("^=1&userContextId=0").isolated)
    XCTAssertFalse(Firefox.originAttributes("").isolated)
  }

  func testNonV10EncryptedValuesAreUndecryptable() {
    let key = Fixtures.chromiumKey
    XCTAssertNil(ChromiumCrypto.decryptSecret(Data("v11garbage-but-printable".utf8), key: key))
    XCTAssertNil(ChromiumCrypto.decryptSecret(Data("v10".utf8) + Data([1, 2, 3]), key: key))
    XCTAssertNil(ChromiumCrypto.decryptSecret(Data("plain".utf8), key: key, hostKey: "example.com"))
  }

  private func record() -> [UInt8] {
    func le32(_ v: Int) -> [UInt8] { (0..<4).map { UInt8((v >> (8 * $0)) & 0xFF) } }
    let strings: [[UInt8]] = ["a.example", "n", "/", "v"].map { Array($0.utf8) + [0] }
    var offsets: [Int] = []
    var at = 56
    for s in strings {
      offsets.append(at)
      at += s.count
    }
    var r = le32(at) + le32(0) + le32(1) + le32(0)
    for o in offsets { r += le32(o) }
    r += [UInt8](repeating: 0, count: 8)
    r += withUnsafeBytes(of: (4_102_444_800.0 - 978_307_200).bitPattern.littleEndian, Array.init)
    r += withUnsafeBytes(of: (1_700_000_000.0 - 978_307_200).bitPattern.littleEndian, Array.init)
    return r + strings.flatMap { $0 }
  }

  private func file(offsets: (Int) -> [Int], records: Int) -> SecretBytes {
    func le32(_ v: Int) -> [UInt8] { (0..<4).map { UInt8((v >> (8 * $0)) & 0xFF) } }
    let rec = record()
    let table = 8 + 4 * offsets(0).count + 4
    var page: [UInt8] = [0, 0, 1, 0] + le32(offsets(0).count)
    for o in offsets(table) { page += le32(o) }
    page += [0, 0, 0, 0]
    for _ in 0..<records { page += rec }
    let size = page.count
    let header: [UInt8] = Array("cook".utf8) + [0, 0, 0, 1] + [UInt8(size >> 24 & 0xFF), UInt8(size >> 16 & 0xFF), UInt8(size >> 8 & 0xFF), UInt8(size & 0xFF)]
    return SecretBytes(header + page + [UInt8](repeating: 0, count: 8))
  }

  func testSafariRecordsMayNotOverlap() throws {
    let len = record().count
    let good = file(offsets: { t in [t, t + len] }, records: 2)
    XCTAssertEqual(try SafariCookies.parse(good).count, 2)
    let repeated = file(offsets: { t in [t, t] }, records: 1)
    XCTAssertThrowsError(try SafariCookies.parse(repeated))
  }

  func testEscapedSafariCardNumberIsMaskedAndSkipped() throws {
    var data = Data(#"{"payment_cards":[{"card_number":"4111\u0031111111111111","cardholder_name":"A"},{"card_number":"4111111111111111"}]}"#.utf8)
    let cards = try SafariExport.paymentCards(&data)
    XCTAssertEqual(cards.count, 1)
    XCTAssertFalse(String(decoding: data, as: UTF8.self).contains("4111"))
    var hidden = Data(#"{"payment_cards":[{"card\u005fnumber":"4111111111111111"}]}"#.utf8)
    XCTAssertThrowsError(try SafariExport.paymentCards(&hidden))
  }
}

final class ZipBombTests: XCTestCase {
  private struct Member {
    var name: String
    var method: UInt16
    var body: [UInt8]
    var declaredSize: Int
  }

  private func zip(_ members: [Member]) -> Data {
    func le16(_ v: Int) -> [UInt8] { (0..<2).map { UInt8((v >> (8 * $0)) & 0xFF) } }
    func le32(_ v: Int) -> [UInt8] { (0..<4).map { UInt8((v >> (8 * $0)) & 0xFF) } }
    var bytes: [UInt8] = []
    var directory: [UInt8] = []
    for member in members {
      let name = Array(member.name.utf8)
      let offset = bytes.count
      bytes += le32(0x0403_4B50) + le16(20) + le16(0) + le16(Int(member.method)) + le16(0) + le16(0) + le32(0)
      bytes += le32(member.body.count) + le32(member.declaredSize) + le16(name.count) + le16(0) + name + member.body
      directory += le32(0x0201_4B50) + le16(20) + le16(20) + le16(0) + le16(Int(member.method)) + le16(0) + le16(0) + le32(0)
      directory += le32(member.body.count) + le32(member.declaredSize) + le16(name.count) + le16(0) + le16(0)
      directory += le16(0) + le16(0) + le32(0) + le32(offset) + name
    }
    let directoryOffset = bytes.count
    bytes += directory
    bytes += le32(0x0605_4B50) + le16(0) + le16(0) + le16(members.count) + le16(members.count)
    bytes += le32(directory.count) + le32(directoryOffset) + le16(0)
    return Data(bytes)
  }

  private let tinyDeflate: [UInt8] = [0x03, 0x00]

  func testEntryDeclaringMoreThanTheCapIsRefusedBeforeInflating() throws {
    let archive = try ZipArchive(zip([Member(name: "History.json", method: 8, body: Array(repeating: 0, count: 400_000), declaredSize: 200 * 1024 * 1024)]))
    XCTAssertThrowsError(try archive.extract(archive.entries[0]))
  }

  func testImplausibleCompressionRatioIsRefused() throws {
    let archive = try ZipArchive(zip([Member(name: "History.json", method: 8, body: tinyDeflate, declaredSize: 64 * 1024 * 1024)]))
    XCTAssertThrowsError(try archive.extract(archive.entries[0]))
  }

  func testArchiveDeclaringTooMuchInTotalIsRefused() {
    let entry = Member(name: "History.json", method: 8, body: Array(repeating: 0, count: 400_000), declaredSize: 100 * 1024 * 1024)
    XCTAssertThrowsError(try ZipArchive(zip([entry, entry, entry])))
  }

  func testEmptyDeflateBodyWithDeclaredOutputIsRefused() throws {
    let archive = try ZipArchive(zip([Member(name: "History.json", method: 8, body: [], declaredSize: 10)]))
    XCTAssertThrowsError(try archive.extract(archive.entries[0]))
  }

  func testStoredEntriesStillExtract() throws {
    let text = Array("{\"history\":[]}".utf8)
    let archive = try ZipArchive(zip([Member(name: "History.json", method: 0, body: text, declaredSize: text.count)]))
    XCTAssertEqual(try archive.extract(archive.entries[0]), Data(text))
  }
}
