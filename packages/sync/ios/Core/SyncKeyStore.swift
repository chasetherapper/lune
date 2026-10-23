import Foundation
import Security

public protocol SyncKeyStore {
  func load(account: String) -> Data?
  func save(_ secret: Data, account: String) -> Bool
  func delete(account: String)
}

public struct KeychainKeyStore: SyncKeyStore {
  public let service: String

  public init(service: String = "Ardia Sync Key") { self.service = service }

  func query(_ account: String) -> [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecAttrSynchronizable as String: false,
    ]
  }

  public func load(account: String) -> Data? {
    var q = query(account)
    q[kSecReturnData as String] = true
    q[kSecMatchLimit as String] = kSecMatchLimitOne
    #if DEBUG
    q[kSecUseAuthenticationUI as String] = kSecUseAuthenticationUIFail
    #endif
    var item: CFTypeRef?
    guard SecItemCopyMatching(q as CFDictionary, &item) == errSecSuccess, let data = item as? Data else { return nil }
    return data
  }

  public func save(_ secret: Data, account: String) -> Bool {
    SecItemDelete(query(account) as CFDictionary)
    var add = query(account)
    add[kSecValueData as String] = secret
    add[kSecAttrLabel as String] = service
    add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    return SecItemAdd(add as CFDictionary, nil) == errSecSuccess
  }

  public func delete(account: String) {
    SecItemDelete(query(account) as CFDictionary)
  }
}

public struct FileKeyStore: SyncKeyStore {
  public let directory: URL

  public init(directory: URL) { self.directory = directory }

  func url(_ account: String) -> URL { directory.appendingPathComponent("sync-key-\(account)") }

  public func load(account: String) -> Data? { try? Data(contentsOf: url(account)) }

  public func save(_ secret: Data, account: String) -> Bool {
    do {
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      let destination = url(account)
      let temporary = directory.appendingPathComponent(".sync-key-\(account).\(getpid()).tmp")
      unlink(temporary.path)
      let fd = open(temporary.path, O_CREAT | O_EXCL | O_WRONLY | O_NOFOLLOW | O_CLOEXEC, 0o600)
      guard fd >= 0 else { return false }
      let wrote = fchmod(fd, 0o600) == 0 && secret.withUnsafeBytes { write(fd, $0.baseAddress, $0.count) } == secret.count
      close(fd)
      guard wrote, rename(temporary.path, destination.path) == 0 else {
        unlink(temporary.path)
        return false
      }
      return true
    } catch {
      return false
    }
  }

  public func delete(account: String) { try? FileManager.default.removeItem(at: url(account)) }
}
