import 'package:sqflite/sqflite.dart';
import '../models/test_record.dart';
import 'database_helper.dart';

/// Data-access object for [TestRecord].
class RecordDao {
  final DatabaseHelper _dbHelper;

  RecordDao({DatabaseHelper? dbHelper})
      : _dbHelper = dbHelper ?? DatabaseHelper.instance;

  Future<Database> get _db => _dbHelper.database;

  /// Insert a new record. Throws on duplicate id.
  Future<void> insertRecord(TestRecord record) async {
    final db = await _db;
    await db.insert(
      'test_records',
      record.toMap(),
      conflictAlgorithm: ConflictAlgorithm.abort,
    );
  }

  /// Query records with optional filters.
  ///
  /// [startDate]/[endDate] filter by timestamp range.
  /// [classification] filters by exact classification string.
  /// [searchQuery] does a LIKE match on the record id.
  Future<List<TestRecord>> getRecords({
    DateTime? startDate,
    DateTime? endDate,
    String? classification,
    String? searchQuery,
  }) async {
    final db = await _db;

    final whereClauses = <String>[];
    final whereArgs = <dynamic>[];

    if (startDate != null) {
      whereClauses.add('timestamp >= ?');
      whereArgs.add(startDate.toUtc().toIso8601String());
    }
    if (endDate != null) {
      whereClauses.add('timestamp <= ?');
      whereArgs.add(endDate.toUtc().toIso8601String());
    }
    if (classification != null && classification.isNotEmpty) {
      whereClauses.add('classification = ?');
      whereArgs.add(classification);
    }
    if (searchQuery != null && searchQuery.isNotEmpty) {
      whereClauses.add('id LIKE ?');
      whereArgs.add('%$searchQuery%');
    }

    final rows = await db.query(
      'test_records',
      where: whereClauses.isEmpty ? null : whereClauses.join(' AND '),
      whereArgs: whereArgs.isEmpty ? null : whereArgs,
      orderBy: 'timestamp DESC',
    );

    return rows.map(TestRecord.fromMap).toList();
  }

  /// Retrieve a single record by id, or null if not found.
  Future<TestRecord?> getRecord(String id) async {
    final db = await _db;
    final rows = await db.query(
      'test_records',
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return TestRecord.fromMap(rows.first);
  }

  /// All records that haven't been synced to the server yet.
  Future<List<TestRecord>> getUnsyncedRecords() async {
    final db = await _db;
    final rows = await db.query(
      'test_records',
      where: 'synced = 0',
      orderBy: 'timestamp ASC',
    );
    return rows.map(TestRecord.fromMap).toList();
  }

  /// Mark a record as synced after a successful server POST.
  Future<void> markSynced(String id) async {
    final db = await _db;
    await db.update(
      'test_records',
      {'synced': 1},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  /// Total record count (all statuses).
  Future<int> getRecordCount() async {
    final db = await _db;
    final result = await db.rawQuery('SELECT COUNT(*) AS cnt FROM test_records');
    return Sqflite.firstIntValue(result) ?? 0;
  }

  /// Delete a record by id.
  Future<void> deleteRecord(String id) async {
    final db = await _db;
    await db.delete(
      'test_records',
      where: 'id = ?',
      whereArgs: [id],
    );
  }
}
