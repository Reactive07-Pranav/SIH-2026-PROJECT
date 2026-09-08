import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:asn1lib/asn1lib.dart';
import 'package:crypto/crypto.dart' as crypto_pkg;
import 'package:pointycastle/export.dart';

import 'secure_storage_service.dart';

/// ECDSA P-256 key generation, record signing, and image hashing.
///
/// Private key bytes are stored in secure storage (Android Keystore-backed).
/// Public key is stored alongside it for convenience and can be uploaded
/// to the backend once via the register-device endpoint.
class CryptoService {
  final SecureStorageService _secureStorage;

  CryptoService({required SecureStorageService secureStorage})
      : _secureStorage = secureStorage;

  // ── Key generation ────────────────────────────────────────────────────

  /// Generate a new ECDSA P-256 keypair.
  ///
  /// Stores both keys in secure storage and returns the public key as a
  /// base64-encoded uncompressed EC point (0x04 ‖ X ‖ Y, 65 bytes).
  Future<String> generateKeyPair() async {
    final params = ECDomainParameters('secp256r1');
    final keyGenParams = ECKeyGeneratorParameters(params);
    final secureRandom = _buildSecureRandom();

    final keyGen = ECKeyGenerator()
      ..init(ParametersWithRandom(keyGenParams, secureRandom));

    final pair = keyGen.generateKeyPair();
    final ECPrivateKey privateKey = pair.privateKey as ECPrivateKey;
    final ECPublicKey publicKey = pair.publicKey as ECPublicKey;

    // Encode private key: big-endian scalar (32 bytes, left-pad with zeros).
    final privBytes = _bigIntToBytes(privateKey.d!, 32);
    final privBase64 = base64Encode(privBytes);

    // Encode public key: uncompressed point (04 ‖ X ‖ Y) = 65 bytes.
    final pubBytes = publicKey.Q!.getEncoded(false);
    final pubBase64 = base64Encode(pubBytes);

    await _secureStorage.storePrivateKey(privBase64);
    await _secureStorage.storePublicKey(pubBase64);

    return pubBase64;
  }

  /// Whether a keypair has already been generated.
  Future<bool> hasKeyPair() async {
    final priv = await _secureStorage.getPrivateKey();
    return priv != null && priv.isNotEmpty;
  }

  /// Retrieve the stored public key as base64.
  Future<String?> getPublicKeyBase64() => _secureStorage.getPublicKey();

  // ── Signing ───────────────────────────────────────────────────────────

  /// Sign arbitrary record JSON.
  ///
  /// 1. Sort the JSON keys for deterministic serialization.
  /// 2. UTF-8 encode → SHA-256 hash.
  /// 3. ECDSA-sign the 32-byte digest.
  /// 4. DER-encode (r, s) → base64.
  Future<String> signRecord(Map<String, dynamic> recordJson) async {
    // Deterministic JSON: sorted keys, no trailing whitespace.
    final sortedJson = _sortedJsonEncode(recordJson);
    final digest = _sha256Bytes(utf8.encode(sortedJson));

    final privBase64 = await _secureStorage.getPrivateKey();
    if (privBase64 == null || privBase64.isEmpty) {
      throw StateError('No private key found — call generateKeyPair() first.');
    }

    final privBytes = base64Decode(privBase64);
    final d = _bytesToBigInt(privBytes);
    final params = ECDomainParameters('secp256r1');
    final privateKey = ECPrivateKey(d, params);

    final signer = ECDSASigner(SHA256Digest())
      ..init(true, PrivateKeyParameter<ECPrivateKey>(privateKey));

    final sig = signer.generateSignature(Uint8List.fromList(digest))
        as ECSignature;

    // DER encode the (r, s) pair so the backend can decode it portably.
    final derBytes = _encodeDerSignature(sig.r, sig.s);
    return base64Encode(derBytes);
  }

  // ── Hashing ───────────────────────────────────────────────────────────

  /// SHA-256 hash of raw image bytes, returned as a lowercase hex string.
  String computeImageHash(Uint8List imageBytes) {
    final digest = crypto_pkg.sha256.convert(imageBytes);
    return digest.toString(); // hex
  }

  // ── Internal helpers ──────────────────────────────────────────────────

  /// Deterministic JSON: keys sorted alphabetically at every nesting level.
  String _sortedJsonEncode(dynamic value) {
    if (value is Map) {
      final sorted = Map.fromEntries(
        value.entries.toList()
          ..sort((a, b) => a.key.toString().compareTo(b.key.toString())),
      );
      final inner = sorted.entries.map((e) {
        final k = jsonEncode(e.key);
        final v = _sortedJsonEncode(e.value);
        return '$k:$v';
      }).join(',');
      return '{$inner}';
    } else if (value is List) {
      return '[${value.map(_sortedJsonEncode).join(',')}]';
    } else {
      return jsonEncode(value);
    }
  }

  /// SHA-256 of a byte list, returned as raw bytes.
  List<int> _sha256Bytes(List<int> input) {
    return crypto_pkg.sha256.convert(input).bytes;
  }

  /// Encode an ECDSA signature (r, s) as ASN.1 DER:
  ///   SEQUENCE { INTEGER r, INTEGER s }
  Uint8List _encodeDerSignature(BigInt r, BigInt s) {
    final seq = ASN1Sequence();
    seq.add(ASN1Integer(r));
    seq.add(ASN1Integer(s));
    return seq.encode();
  }

  /// Convert a [BigInt] to a fixed-length big-endian byte list.
  Uint8List _bigIntToBytes(BigInt value, int length) {
    final hexStr = value.toRadixString(16).padLeft(length * 2, '0');
    final bytes = Uint8List(length);
    for (var i = 0; i < length; i++) {
      bytes[i] = int.parse(hexStr.substring(i * 2, i * 2 + 2), radix: 16);
    }
    return bytes;
  }

  /// Convert big-endian bytes to [BigInt].
  BigInt _bytesToBigInt(List<int> bytes) {
    return BigInt.parse(
      bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join(),
      radix: 16,
    );
  }

  /// Build a platform-independent secure random using Fortuna.
  SecureRandom _buildSecureRandom() {
    final rng = FortunaRandom();
    final seed = Uint8List(32);
    final dartRng = Random.secure();
    for (var i = 0; i < 32; i++) {
      seed[i] = dartRng.nextInt(256);
    }
    rng.seed(KeyParameter(seed));
    return rng;
  }
}
