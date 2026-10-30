import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:camera/camera.dart';

import 'providers/auth_provider.dart';
import 'providers/record_provider.dart';
import 'screens/login_screen.dart';
import 'screens/capture_screen.dart';
import 'screens/result_screen.dart';
import 'screens/log_screen.dart';
import 'screens/record_detail_screen.dart';
import 'screens/corner_selection_screen.dart';
import 'data/database_helper.dart';
import 'services/secure_storage_service.dart';
import 'services/crypto_service.dart';

List<CameraDescription> cameras = [];

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Lock orientation to portrait for consistent camera overlay alignment.
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
  ]);

  // Initialize cameras.
  try {
    cameras = await availableCameras();
  } on CameraException catch (e) {
    debugPrint('Camera init error: ${e.code} - ${e.description}');
  }

  // Initialize database.
  await DatabaseHelper.instance.database;

  // Ensure ECDSA keypair exists on first launch.
  final cryptoService = CryptoService();
  if (!await cryptoService.hasKeyPair()) {
    await cryptoService.generateKeyPair();
  }

  runApp(const DrugTestApp());
}

class DrugTestApp extends StatelessWidget {
  const DrugTestApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => RecordProvider()),
      ],
      child: MaterialApp(
        title: 'DrugTest Evidence',
        debugShowCheckedModeBanner: false,
        theme: _buildTheme(),
        home: const AuthGate(),
        onGenerateRoute: _onGenerateRoute,
      ),
    );
  }

  ThemeData _buildTheme() {
    const primaryColor = Color(0xFF00695C);
    const surfaceColor = Color(0xFF121212);

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: ColorScheme.dark(
        primary: primaryColor,
        onPrimary: Colors.white,
        secondary: const Color(0xFF80CBC4),
        surface: surfaceColor,
        onSurface: Colors.white,
        error: const Color(0xFFCF6679),
        primaryContainer: primaryColor.withAlpha(80),
        secondaryContainer: const Color(0xFF004D40),
      ),
      scaffoldBackgroundColor: surfaceColor,
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xFF1E1E1E),
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
      ),
      cardTheme: CardThemeData(
        color: const Color(0xFF1E1E1E),
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryColor,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xFF2C2C2C),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: primaryColor, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }

  Route<dynamic>? _onGenerateRoute(RouteSettings settings) {
    switch (settings.name) {
      case '/login':
        return MaterialPageRoute(builder: (_) => const LoginScreen());
      case '/capture':
        return MaterialPageRoute(builder: (_) => const CaptureScreen());
      case '/corner-selection':
        final args = settings.arguments as Map<String, dynamic>;
        return MaterialPageRoute(
          builder: (_) => CornerSelectionScreen(imagePath: args['imagePath'] as String),
        );
      case '/result':
        final args = settings.arguments as Map<String, dynamic>;
        return MaterialPageRoute(builder: (_) => ResultScreen(args: args));
      case '/log':
        return MaterialPageRoute(builder: (_) => const LogScreen());
      case '/record-detail':
        final recordId = settings.arguments as String;
        return MaterialPageRoute(
          builder: (_) => RecordDetailScreen(recordId: recordId),
        );
      default:
        return MaterialPageRoute(builder: (_) => const LoginScreen());
    }
  }
}

/// Gates the app between login and main content based on auth state.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  bool _checking = true;

  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    final authProvider = context.read<AuthProvider>();
    await authProvider.checkLoggedIn();
    if (mounted) setState(() => _checking = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final auth = context.watch<AuthProvider>();
    if (auth.isLoggedIn) {
      return const LogScreen();
    }
    return const LoginScreen();
  }
}
