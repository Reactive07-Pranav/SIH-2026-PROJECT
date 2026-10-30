import 'dart:convert';

import 'package:crypto/crypto.dart' as crypto_pkg;
import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import 'secure_storage_service.dart';

/// Handles operator login, cached offline login, and logout.
class AuthService {
  final SecureStorageService _secureStorage;
  final http.Client _httpClient;

  AuthService({
    required SecureStorageService secureStorage,
    http.Client? httpClient,
  })  : _secureStorage = secureStorage,
        _httpClient = httpClient ?? http.Client();

  // ── Online login ──────────────────────────────────────────────────────

  /// Authenticate against the backend.
  ///
  /// On success, stores the JWT, operator ID, and a salted hash of the
  /// password (so the operator can log in again while offline).
  /// Returns `null` on success or an error message string on failure.
  Future<String?> login(String operatorId, String password) async {
    try {
      final response = await _httpClient.post(
        Uri.parse('${AppConfig.backendUrl}/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'operator_id': operatorId,
          'password': password,
        }),
      );

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        final token = body['token'] as String?;
        if (token == null || token.isEmpty) {
          return 'Server returned no token';
        }

        await _secureStorage.storeJwt(token);
        await _secureStorage.storeOperatorId(operatorId);

        // Cache a password hash for offline login.
        final hash = _hashPassword(operatorId, password);
        await _secureStorage.storeCachedPasswordHash(hash);

        return null; // success
      } else if (response.statusCode == 401) {
        return 'Invalid credentials';
      } else {
        return 'Server error (${response.statusCode})';
      }
    } catch (e) {
      return 'Network error: $e';
    }
  }

  // ── Offline / cached login ────────────────────────────────────────────

  /// Attempt a cached login using a previously stored password hash.
  ///
  /// This allows the operator to continue working when there is no network.
  /// Returns `null` on success or an error message on failure.
  Future<String?> cachedLogin(String operatorId, String password) async {
    final storedHash = await _secureStorage.getCachedPasswordHash();
    final storedOperator = await _secureStorage.getOperatorId();

    if (storedHash == null || storedOperator == null) {
      return 'No cached credentials — you must log in online first';
    }
    if (storedOperator != operatorId) {
      return 'Cached credentials are for a different operator';
    }

    final hash = _hashPassword(operatorId, password);
    if (hash != storedHash) {
      return 'Invalid offline credentials';
    }

    // The JWT may be expired, but we allow local use.
    return null; // success
  }

  // ── Session helpers ───────────────────────────────────────────────────

  Future<bool> isLoggedIn() => _secureStorage.isLoggedIn();

  Future<void> logout() async {
    await _secureStorage.deleteJwt();
    // Keep operatorId and cached hash so the operator can log back in offline.
  }

  /// Stored operator ID (may be non-null even when logged out if cached).
  Future<String?> getStoredOperatorId() => _secureStorage.getOperatorId();

  /// Stored JWT (may be expired).
  Future<String?> getStoredJwt() => _secureStorage.getJwt();

  // ── Internal ──────────────────────────────────────────────────────────

  /// Deterministic password hash: SHA-256(operatorId + ":" + password).
  /// Good enough for a hackathon demo; a production app would use bcrypt.
  String _hashPassword(String operatorId, String password) {
    final bytes = utf8.encode('$operatorId:$password');
    return crypto_pkg.sha256.convert(bytes).toString();
  }
}
