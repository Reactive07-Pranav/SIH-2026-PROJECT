import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../pipeline/models.dart';
import '../models/test_record.dart';
import '../providers/record_provider.dart';
import '../providers/auth_provider.dart';
import '../services/crypto_service.dart';
import '../services/location_service.dart';

class ResultScreen extends StatefulWidget {
  final ProcessingResult processingResult;
  final String imagePath;

  const ResultScreen({
    super.key,
    required this.processingResult,
    required this.imagePath,
  });

  @override
  State<ResultScreen> createState() => _ResultScreenState();
}

class _ResultScreenState extends State<ResultScreen> {
  bool _isSaving = false;

  String _getResultLabel() {
    switch (widget.processingResult.classification.classification) {
      case Classification.positive:
        return 'POSITIVE';
      case Classification.negative:
        return 'NEGATIVE';
      case Classification.inconclusive:
        return 'INCONCLUSIVE';
    }
  }

  Color _getResultColor() {
    switch (widget.processingResult.classification.classification) {
      case Classification.positive:
        return Colors.red.shade400;
      case Classification.negative:
        return Colors.green.shade400;
      case Classification.inconclusive:
        return Colors.amber.shade600;
    }
  }

  IconData _getResultIcon() {
    switch (widget.processingResult.classification.classification) {
      case Classification.positive:
        return Icons.warning_rounded;
      case Classification.negative:
        return Icons.check_circle_rounded;
      case Classification.inconclusive:
        return Icons.help_rounded;
    }
  }

  Future<void> _saveRecord() async {
    setState(() => _isSaving = true);

    try {
      final auth = context.read<AuthProvider>();
      final recordProvider = context.read<RecordProvider>();
      final cryptoService = CryptoService();
      final locationService = LocationService();

      final (lat, lon) = await locationService.getCurrentLocation();
      final imageBytes = await File(widget.imagePath).readAsBytes();
      final imageHash = await cryptoService.computeImageHash(imageBytes);

      final recordId = const Uuid().v4();
      final classification = widget.processingResult.classification;
      final record = TestRecord(
        id: recordId,
        timestamp: DateTime.now(),
        latitude: lat,
        longitude: lon,
        operatorId: auth.operatorId ?? 'unknown',
        deviceId: 'mobile-device',
        imageHash: imageHash,
        imagePath: widget.imagePath,
        classification: _getResultLabel().toLowerCase(),
        deltaE: classification.deltaE,
        correctedRgb: classification.correctedRgb,
        signature: '',
        synced: false,
      );

      final recordJson = record.toJson();
      recordJson.remove('signature');
      final signature = await cryptoService.signRecord(recordJson);
      final signedRecord = record.copyWith(signature: signature);
      await recordProvider.addRecord(signedRecord);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Record saved successfully'),
          backgroundColor: Colors.green,
          duration: Duration(seconds: 2),
        ),
      );
      Navigator.of(context).pushNamedAndRemoveUntil(
        '/log', (route) => false,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSaving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Save failed: $e')),
      );
    }
  }

  void _retake() {
    Navigator.of(context).pushNamedAndRemoveUntil('/capture', (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    final result = widget.processingResult.classification;
    final isInconclusive =
        result.classification == Classification.inconclusive;

    return Scaffold(
      appBar: AppBar(title: const Text('Test Result')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (isInconclusive)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.amber.shade800,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.warning_amber_rounded, color: Colors.white),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Result inconclusive — consider retaking the test',
                        style: TextStyle(color: Colors.white, fontSize: 14),
                      ),
                    ),
                  ],
                ),
              ),
            if (isInconclusive) const SizedBox(height: 16),

            Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    Icon(
                      _getResultIcon(),
                      size: 80,
                      color: _getResultColor(),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      _getResultLabel(),
                      style: TextStyle(
                        fontSize: 36,
                        fontWeight: FontWeight.bold,
                        color: _getResultColor(),
                      ),
                    ),
                    const SizedBox(height: 24),
                    Divider(color: Colors.white24),
                    const SizedBox(height: 16),
                    _buildInfoRow('Delta E', result.deltaE.toStringAsFixed(2)),
                    const SizedBox(height: 8),
                    _buildInfoRow('Corrected RGB', result.correctedRgb.join(', ')),
                    const SizedBox(height: 8),
                    _buildInfoRow('LAB', 'L*=${result.labValues[0].toStringAsFixed(1)}, a*=${result.labValues[1].toStringAsFixed(1)}, b*=${result.labValues[2].toStringAsFixed(1)}'),
                    const SizedBox(height: 16),
                    Container(
                      height: 50,
                      decoration: BoxDecoration(
                        color: Color.fromARGB(
                          255,
                          result.correctedRgb[0],
                          result.correctedRgb[1],
                          result.correctedRgb[2],
                        ),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.white30),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.file(
                  File(widget.imagePath),
                  height: 200,
                  fit: BoxFit.cover,
                ),
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _retake,
                    child: const Text('Retake'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: _isSaving ? null : _saveRecord,
                    child: _isSaving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Save & Continue'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 14)),
        Text(value,
            style: const TextStyle(
                color: Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.w500),
            overflow: TextOverflow.ellipsis),
      ],
    );
  }
}
