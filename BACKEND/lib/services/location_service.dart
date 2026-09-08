import 'package:geolocator/geolocator.dart';

/// GPS helper that handles runtime permissions and gracefully falls back
/// to (0, 0) when a location cannot be obtained.
class LocationData {
  final double latitude;
  final double longitude;

  const LocationData({required this.latitude, required this.longitude});

  bool get isFallback => latitude == 0 && longitude == 0;

  Map<String, double> toJson() => {
        'latitude': latitude,
        'longitude': longitude,
      };
}

class LocationService {
  /// Request permission (if needed) and return the current position.
  ///
  /// If the user denies permission, location services are disabled, or the
  /// GPS times out, returns (0, 0) rather than preventing a test from being
  /// recorded. The UI can flag a fallback location to the operator.
  Future<LocationData> getCurrentLocation() async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) return const LocationData(latitude: 0, longitude: 0);

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return const LocationData(latitude: 0, longitude: 0);
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );

      return LocationData(
        latitude: position.latitude,
        longitude: position.longitude,
      );
    } catch (_) {
      return const LocationData(latitude: 0, longitude: 0);
    }
  }
}
