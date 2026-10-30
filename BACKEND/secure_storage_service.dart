import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/app_config.dart';

/// Thin wrapper around [FlutterSecureStorage] with typed accessors
/// for every secret the app persists (JWT, keypair, operator/device IDs).
class SecureStorageService {
  final FlutterSecureStorage _storage;

  SecureStorageService({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  // ── JWT ───────────────────────────────────────────────────────────────

  Future<void> storeJwt(String token) =>
      _storage.write(key: AppConfig.keyJwt, value: token);

  Future<String?> getJwt() => _storage.read(key: AppConfig.keyJwt);

  Future<void> deleteJwt() => _storage.delete(key: AppConfig.keyJwt);

  // ── Operator ID ───────────────────────────────────────────────────────

  Future<void> storeOperatorId(String id) =>
      _storage.write(key: AppConfig.keyOperatorId, value: id);

  Future<String?> getOperatorId() =>
      _storage.read(key: AppConfig.keyOperatorId);

  // ── Device ID ─────────────────────────────────────────────────────────

  Future<void> storeDeviceId(String id) =>
      _storage.write(key: AppConfig.keyDeviceId, value: id);

  Future<String?> getDeviceId() => _storage.read(key: AppConfig.keyDeviceId);

  // ── ECDSA Private Key (base64-encoded raw bytes) ──────────────────────

  Future<void> storePrivateKey(String keyBase64) =>
      _storage.write(key: AppConfig.keyPrivateKey, value: keyBase64);

  Future<String?> getPrivateKey() =>
      _storage.read(key: AppConfig.keyPrivateKey);

  // ── ECDSA Public Key (base64-encoded uncompressed point) ──────────────

  Future<void> storePublicKey(String keyBase64) =>
      _storage.write(key: AppConfig.keyPublicKey, value: keyBase64);

  Future<String?> getPublicKey() =>
      _storage.read(key: AppConfig.keyPublicKey);

  // ── Cached password hash (for offline login) ──────────────────────────

  Future<void> storeCachedPasswordHash(String hash) =>
      _storage.write(key: AppConfig.keyCachedPasswordHash, value: hash);

  Future<String?> getCachedPasswordHash() =>
      _storage.read(key: AppConfig.keyCachedPasswordHash);

  // ── Convenience ───────────────────────────────────────────────────────

  Future<bool> isLoggedIn() async {
    final jwt = await getJwt();
    return jwt != null && jwt.isNotEmpty;
  }

  Future<void> clearAll() async {
    await _storage.deleteAll();
  }
}
