import 'package:flutter/material.dart';
import '../models/test_record.dart';
import '../data/record_dao.dart';
import '../services/sync_service.dart';

class RecordProvider extends ChangeNotifier {
  final RecordDao _dao = RecordDao();
  final SyncService _syncService = SyncService();

  List<TestRecord> _records = [];
  bool _isLoading = false;
  bool _isSyncing = false;
  String? _errorMessage;
  int _totalCount = 0;

  // Active filters.
  String? _classificationFilter;
  DateTime? _startDate;
  DateTime? _endDate;
  String? _searchQuery;

  List<TestRecord> get records => _records;
  bool get isLoading => _isLoading;
  bool get isSyncing => _isSyncing;
  String? get errorMessage => _errorMessage;
  int get totalCount => _totalCount;
  String? get classificationFilter => _classificationFilter;
  DateTime? get startDate => _startDate;
  DateTime? get endDate => _endDate;
  String? get searchQuery => _searchQuery;

  int get unsyncedCount => _records.where((r) => !r.synced).length;

  /// Load records with the current filter state.
  Future<void> loadRecords() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _records = await _dao.getRecords(
        startDate: _startDate,
        endDate: _endDate,
        classification: _classificationFilter,
        searchQuery: _searchQuery,
      );
      _totalCount = await _dao.getRecordCount();
    } catch (e) {
      _errorMessage = 'Failed to load records: $e';
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Update classification filter and reload.
  void setClassificationFilter(String? classification) {
    _classificationFilter = classification;
    loadRecords();
  }

  /// Update date range filter and reload.
  void setDateRange(DateTime? start, DateTime? end) {
    _startDate = start;
    _endDate = end;
    loadRecords();
  }

  /// Update search query and reload.
  void setSearchQuery(String? query) {
    _searchQuery = (query != null && query.trim().isEmpty) ? null : query;
    loadRecords();
  }

  /// Clear all filters.
  void clearFilters() {
    _classificationFilter = null;
    _startDate = null;
    _endDate = null;
    _searchQuery = null;
    loadRecords();
  }

  /// Insert a new record and refresh the list.
  Future<void> addRecord(TestRecord record) async {
    await _dao.insertRecord(record);
    await loadRecords();
  }

  /// Fetch a single record by id.
  Future<TestRecord?> getRecord(String id) async {
    return await _dao.getRecord(id);
  }

  /// Sync all unsynced records to the backend.
  Future<SyncResult> syncAll() async {
    _isSyncing = true;
    notifyListeners();

    SyncResult result;
    try {
      result = await _syncService.syncRecords();
      await loadRecords(); // refresh sync status
    } catch (e) {
      result = SyncResult(synced: 0, failed: 0, total: 0, error: e.toString());
    }

    _isSyncing = false;
    notifyListeners();
    return result;
  }

  /// Verify a single record against the server.
  Future<Map<String, dynamic>> verifyRecord(String recordId) async {
    return await _syncService.verifyRecord(recordId);
  }
}
