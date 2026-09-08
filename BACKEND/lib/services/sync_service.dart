import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import '../data/record_dao.dart';
import '../models/test_record.dart';
import 'secure_storage_service.dart';

/// Outcome of a [SyncService.syncRecords] run.
class SyncResult {
  final int total;
  final int synced;
  final int failed;
  final List<String> errors;

  const SyncResult({
    required this.total,
    required this.synced,
    required this.failed,
    this.errors = const [],
  });

  @override
  String toString() =>
      'SyncResult(total: $total, synced: $synced, failed: $failed)';
}

/// Outcome of a single-record server verification.
class VerifyResult {
  final bool verified;
  final String message;

  const VerifyResult({required this.verified, required this.message});
}

/// Handles uploading unsynced records to the backend and verifying records.
class SyncService {
  final RecordDao _dao;
  final SecureStorageService _secureStorage;
  final http.Client _httpClient;

  SyncService({
    required RecordDao dao,
    required SecureStorageService secureStorage,
    http.Client? httpClient,
  })  : _dao = dao,
        _secureStorage = secureStorage,
        _httpClient = httpClient ?? http.Client();

  // ── Bulk sync ─────────────────────────────────────────────────────────

  /// POST every unsynced record to the backend. Returns aggregate results.
  ///
  /// Skips the run entirely if the device is offline.
  Future<SyncResult> syncRecords() async {
    // Connectivity check — bail early if offline.
    final connectivity = await Connectivity().checkConnectivity();
    if (connectivity.contains(ConnectivityResult.none)) {
      return const SyncResult(total: 0, synced: 0, failed: 0,
          errors: ['No network connection']);
    }

    final jwt = await _secureStorage.getJwt();
    if (jwt == null || jwt.isEmpty) {
      return const SyncResult(total: 0, synced: 0, failed: 0,
          errors: ['Not authenticated']);
    }

    final unsynced = await _dao.getUnsyncedRecords();
    if (unsynced.isEmpty) {
      return const SyncResult(total: 0, synced: 0, failed: 0);
    }

    int syncedCount = 0;
    int failedCount = 0;
    final errors = <String>[];

    for (final record in unsynced) {
      try {
        final response = await _httpClient.post(
          Uri.parse('${AppConfig.backendUrl}/api/records'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $jwt',
          },
          body: jsonEncode(record.toJson()),
        );

        if (response.statusCode >= 200 && response.statusCode < 300) {
          await _dao.markSynced(record.id);
          syncedCount++;
        } else {
          failedCount++;
          errors.add(
              'Record ${record.id}: HTTP ${response.statusCode} — ${response.body}');
        }
      } catch (e) {
        failedCount++;
        errors.add('Record ${record.id}: $e');
      }
    }

    return SyncResult(
      total: unsynced.length,
      synced: syncedCount,
      failed: failedCount,
      errors: errors,
    );
  }

  // ── Single-record verification ────────────────────────────────────────

  /// Ask the server to verify a record's signature and integrity.
  Future<VerifyResult> verifyRecord(String recordId) async {
    final jwt = await _secureStorage.getJwt();
    if (jwt == null || jwt.isEmpty) {
      return const VerifyResult(
          verified: false, message: 'Not authenticated');
    }

    try {
      final response = await _httpClient.post(
        Uri.parse('${AppConfig.backendUrl}/api/records/verify'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $jwt',
        },
        body: jsonEncode({'record_id': recordId}),
      );

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        return VerifyResult(
          verified: body['verified'] as bool? ?? false,
          message: body['message'] as String? ?? 'OK',
        );
      } else {
        return VerifyResult(
          verified: false,
          message: 'Server returned ${response.statusCode}',
        );
      }
    } catch (e) {
      return VerifyResult(verified: false, message: 'Error: $e');
    }
  }

  // ── Device registration ───────────────────────────────────────────────

  /// Upload this device's ECDSA public key so the server can verify
  /// signatures produced by this device.
  Future<bool> registerDevice(String publicKeyBase64) async {
    final jwt = await _secureStorage.getJwt();
    final operatorId = await _secureStorage.getOperatorId();
    final deviceId = await _secureStorage.getDeviceId();

    if (jwt == null || operatorId == null || deviceId == null) {
      return false;
    }

    try {
      final response = await _httpClient.post(
        Uri.parse('${AppConfig.backendUrl}/api/operators/register-device'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $jwt',
        },
        body: jsonEncode({
          'operator_id': operatorId,
          'device_id': deviceId,
          'public_key': publicKeyBase64,
        }),
      );

      return response.statusCode >= 200 && response.statusCode < 300;
    } catch (_) {
      return false;
    }
  }
}
