import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart' as p;
import '../config/app_config.dart';

/// Singleton wrapper around the SQLite database.
///
/// Usage:
///   final db = await DatabaseHelper.instance.database;
class DatabaseHelper {
  DatabaseHelper._internal();
  static final DatabaseHelper instance = DatabaseHelper._internal();

  Database? _database;

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    final dbPath = await getDatabasesPath();
    final path = p.join(dbPath, AppConfig.databaseName);

    return openDatabase(
      path,
      version: AppConfig.databaseVersion,
      onCreate: _onCreate,
      onUpgrade: _onUpgrade,
      onConfigure: (db) async {
        // Enable foreign keys (good practice even if we have one table today).
        await db.execute('PRAGMA foreign_keys = ON');
      },
    );
  }

  /// Called once when the database is first created.
  Future<void> _onCreate(Database db, int version) async {
    await db.execute('''
      CREATE TABLE test_records (
        id              TEXT PRIMARY KEY,
        timestamp       TEXT    NOT NULL,
        latitude        REAL    NOT NULL,
        longitude       REAL    NOT NULL,
        operator_id     TEXT    NOT NULL,
        device_id       TEXT    NOT NULL,
        image_hash      TEXT    NOT NULL,
        image_path      TEXT    NOT NULL,
        classification  TEXT    NOT NULL,
        delta_e         REAL    NOT NULL,
        corrected_rgb   TEXT    NOT NULL,
        signature       TEXT    NOT NULL,
        synced          INTEGER NOT NULL DEFAULT 0
      )
    ''');

    await db.execute(
        'CREATE INDEX idx_timestamp ON test_records(timestamp)');
    await db.execute(
        'CREATE INDEX idx_classification ON test_records(classification)');
    await db.execute(
        'CREATE INDEX idx_synced ON test_records(synced)');
  }

  /// Called when [AppConfig.databaseVersion] is bumped.
  /// Add migration logic per version here.
  Future<void> _onUpgrade(Database db, int oldVersion, int newVersion) async {
    // Example migration scaffold:
    // if (oldVersion < 2) {
    //   await db.execute('ALTER TABLE test_records ADD COLUMN notes TEXT');
    // }
  }

  /// Close the database — call on app dispose if needed.
  Future<void> close() async {
    final db = _database;
    if (db != null && db.isOpen) {
      await db.close();
      _database = null;
    }
  }
}
