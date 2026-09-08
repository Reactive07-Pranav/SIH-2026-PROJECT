import 'dart:convert';

/// A single completed drug-test record with evidentiary metadata.
class TestRecord {
  final String id;
  final DateTime timestamp;
  final double latitude;
  final double longitude;
  final String operatorId;
  final String deviceId;
  final String imageHash;
  final String imagePath;
  final String classification; // 'positive', 'negative', 'inconclusive'
  final double deltaE;
  final List<int> correctedRgb; // [r, g, b]
  final String signature; // base64 ECDSA signature of the record JSON
  final bool synced;

  const TestRecord({
    required this.id,
    required this.timestamp,
    required this.latitude,
    required this.longitude,
    required this.operatorId,
    required this.deviceId,
    required this.imageHash,
    required this.imagePath,
    required this.classification,
    required this.deltaE,
    required this.correctedRgb,
    required this.signature,
    this.synced = false,
  });

  /// Build from a SQLite row map.
  factory TestRecord.fromMap(Map<String, dynamic> map) {
    // corrected_rgb is stored as a JSON string "[r,g,b]"
    final rgbRaw = map['corrected_rgb'];
    final List<int> rgb;
    if (rgbRaw is String) {
      rgb = (jsonDecode(rgbRaw) as List).cast<int>();
    } else {
      rgb = [0, 0, 0];
    }

    return TestRecord(
      id: map['id'] as String,
      timestamp: DateTime.parse(map['timestamp'] as String),
      latitude: (map['latitude'] as num).toDouble(),
      longitude: (map['longitude'] as num).toDouble(),
      operatorId: map['operator_id'] as String,
      deviceId: map['device_id'] as String,
      imageHash: map['image_hash'] as String,
      imagePath: map['image_path'] as String,
      classification: map['classification'] as String,
      deltaE: (map['delta_e'] as num).toDouble(),
      correctedRgb: rgb,
      signature: map['signature'] as String,
      synced: (map['synced'] as int) == 1,
    );
  }

  /// Serialize to a SQLite row map.
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'timestamp': timestamp.toUtc().toIso8601String(),
      'latitude': latitude,
      'longitude': longitude,
      'operator_id': operatorId,
      'device_id': deviceId,
      'image_hash': imageHash,
      'image_path': imagePath,
      'classification': classification,
      'delta_e': deltaE,
      'corrected_rgb': jsonEncode(correctedRgb),
      'signature': signature,
      'synced': synced ? 1 : 0,
    };
  }

  /// The evidentiary JSON that gets signed — all fields except the signature
  /// itself and the synced flag.  Keys are sorted for deterministic hashing.
  Map<String, dynamic> toSignableJson() {
    final map = <String, dynamic>{
      'classification': classification,
      'corrected_rgb': correctedRgb,
      'delta_e': deltaE,
      'device_id': deviceId,
      'id': id,
      'image_hash': imageHash,
      'latitude': latitude,
      'longitude': longitude,
      'operator_id': operatorId,
      'timestamp': timestamp.toUtc().toIso8601String(),
    };
    return Map.fromEntries(
      map.entries.toList()..sort((a, b) => a.key.compareTo(b.key)),
    );
  }

  /// Full JSON representation (for display / network).
  Map<String, dynamic> toJson() {
    return {
      ...toSignableJson(),
      'signature': signature,
      'synced': synced,
    };
  }

  /// Immutable copy helper.
  TestRecord copyWith({
    String? id,
    DateTime? timestamp,
    double? latitude,
    double? longitude,
    String? operatorId,
    String? deviceId,
    String? imageHash,
    String? imagePath,
    String? classification,
    double? deltaE,
    List<int>? correctedRgb,
    String? signature,
    bool? synced,
  }) {
    return TestRecord(
      id: id ?? this.id,
      timestamp: timestamp ?? this.timestamp,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      operatorId: operatorId ?? this.operatorId,
      deviceId: deviceId ?? this.deviceId,
      imageHash: imageHash ?? this.imageHash,
      imagePath: imagePath ?? this.imagePath,
      classification: classification ?? this.classification,
      deltaE: deltaE ?? this.deltaE,
      correctedRgb: correctedRgb ?? this.correctedRgb,
      signature: signature ?? this.signature,
      synced: synced ?? this.synced,
    );
  }

  @override
  String toString() =>
      'TestRecord(id: $id, classification: $classification, synced: $synced)';
}
