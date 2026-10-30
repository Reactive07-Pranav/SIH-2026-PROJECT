import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/secure_storage_service.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService _authService = AuthService();
  final SecureStorageService _storage = SecureStorageService();

  bool _isLoggedIn = false;
  bool _isLoading = false;
  String? _operatorId;
  String? _errorMessage;
  bool _isOffline = false;

  bool get isLoggedIn => _isLoggedIn;
  bool get isLoading => _isLoading;
  String? get operatorId => _operatorId;
  String? get errorMessage => _errorMessage;
  bool get isOffline => _isOffline;

  /// Check persisted auth state on startup.
  Future<void> checkLoggedIn() async {
    _isLoading = true;
    notifyListeners();

    try {
      _isLoggedIn = await _authService.isLoggedIn();
      if (_isLoggedIn) {
        _operatorId = await _storage.getOperatorId();
      }
    } catch (e) {
      _isLoggedIn = false;
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Attempt server login; falls back to cached login when offline.
  Future<bool> login(String operatorId, String password) async {
    _isLoading = true;
    _errorMessage = null;
    _isOffline = false;
    notifyListeners();

    try {
      final success = await _authService.login(operatorId, password);
      if (success) {
        _isLoggedIn = true;
        _operatorId = operatorId;
        _isLoading = false;
        notifyListeners();
        return true;
      }
      _errorMessage = 'Invalid credentials';
    } catch (e) {
      // Server unreachable — try cached credentials for offline use.
      try {
        final cached = await _authService.cachedLogin(operatorId, password);
        if (cached) {
          _isLoggedIn = true;
          _operatorId = operatorId;
          _isOffline = true;
          _isLoading = false;
          notifyListeners();
          return true;
        }
      } catch (_) {}
      _errorMessage = 'Login failed: ${e.toString()}';
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  Future<void> logout() async {
    await _authService.logout();
    _isLoggedIn = false;
    _operatorId = null;
    _isOffline = false;
    notifyListeners();
  }
}
