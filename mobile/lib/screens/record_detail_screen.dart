import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/record_provider.dart';
import '../models/test_record.dart';

class RecordDetailScreen extends StatefulWidget {
  final String recordId;

  const RecordDetailScreen({super.key, required this.recordId});

  @override
  State<RecordDetailScreen> createState() => _RecordDetailScreenState();
}

class _RecordDetailScreenState extends State<RecordDetailScreen> {
  bool _showFullJson = false;
  bool _verifying = false;
  String? _verifyResult;

  Future<void> _verifyOnServer() async {
    setState(() {
      _verifying = true;
      _verifyResult = null;
    });

    try {
      final result = await context.read<RecordProvider>().verifyRecord(
            widget.recordId,
          );
      setState(() => _verifyResult = result['status'] ?? 'unknown');
    } catch (e) {
      setState(() => _verifyResult = 'error: $e');
    } finally {
      setState(() => _verifying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<RecordProvider>();

    return FutureBuilder<TestRecord?>(
      future: provider.getRecord(widget.recordId),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        if (snapshot.hasError || snapshot.data == null) {
          return Scaffold(
            appBar: AppBar(title: const Text('Record Detail')),
            body: const Center(
              child: Text('Record not found'),
            ),
          );
        }

        final record = snapshot.data!;
        return Scaffold(
          appBar: AppBar(
            title: const Text('Record Detail'),
          ),
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Classification header.
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      children: [
                        Text(
                          record.classification.toUpperCase(),
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                            color: record.classification == 'positive'
                                ? Colors.red.shade400
                                : record.classification == 'negative'
                                    ? Colors.green.shade400
                                    : Colors.amber.shade600,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Record #${record.id.substring(0, 8)}',
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(color: Colors.white54),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Details grid.
                _buildDetailRow('Timestamp',
                    '${record.timestamp.toLocal()}'),
                _buildDetailRow('GPS',
                    '${record.latitude.toStringAsFixed(4)}, ${record.longitude.toStringAsFixed(4)}'),
                _buildDetailRow('Operator', record.operatorId),
                _buildDetailRow('Device', record.deviceId),
                _buildDetailRow('Image Hash', record.imageHash),
                _buildDetailRow('Delta E',
                    record.deltaE.toStringAsFixed(2)),
                _buildDetailRow(
                  'Corrected RGB',
                  '${record.correctedRgb.join(', ')}',
                ),
                _buildDetailRow(
                  'Synced',
                  record.synced ? 'Yes' : 'No',
                  valueColor: record.synced ? Colors.green : Colors.orange,
                ),
                const SizedBox(height: 8),
                _buildDetailRow('Signature',
                    record.signature.isNotEmpty
                        ? '${record.signature.substring(0, 32)}...'
                        : '(none)'),
                const SizedBox(height: 16),

                // Signature expandable.
                ExpansionTile(
                  title: const Text('Full Signature'),
                  initiallyExpanded: false,
                  children: [
                    SelectableText(
                      record.signature.isNotEmpty
                          ? record.signature
                          : '(empty)',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                // JSON expandable.
                ExpansionTile(
                  title: const Text('Raw JSON'),
                  initiallyExpanded: _showFullJson,
                  onExpansionChanged: (expanded) {
                    setState(() => _showFullJson = expanded);
                  },
                  children: [
                    SelectableText(
                      const JsonEncoder.withIndent('  ')
                          .convert(record.toJson()),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Image thumbnail.
                if (record.imagePath.isNotEmpty &&
                    File(record.imagePath).existsSync())
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.file(
                      File(record.imagePath),
                      height: 160,
                      fit: BoxFit.cover,
                    ),
                  ),
                const SizedBox(height: 24),

                // Verify button.
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _verifying ? null : _verifyOnServer,
                    icon: _verifying
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.verified_user),
                    label: Text(
                      _verifying ? 'Verifying…' : 'Verify on Server',
                    ),
                  ),
                ),
                if (_verifyResult != null) ...[
                  const SizedBox(height: 12),
                  Card(
                    color: Theme.of(context).colorScheme.surfaceVariant,
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Text(
                        'Verification result: $_verifyResult',
                        style: TextStyle(
                          color: _verifyResult!.contains('verified')
                              ? Colors.green
                              : Colors.red,
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildDetailRow(String label, String value,
      {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(
            flex: 4,
            child: Text(
              label,
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 13,
              ),
            ),
          ),
          Expanded(
            flex: 6,
            child: Text(
              value,
              style: TextStyle(
                color: valueColor ?? Colors.white,
                fontSize: 13,
                fontFamily: 'monospace',
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}
