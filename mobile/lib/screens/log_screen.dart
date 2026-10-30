import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/record_provider.dart';
import '../models/test_record.dart';
import 'record_detail_screen.dart';

class LogScreen extends StatefulWidget {
  const LogScreen({super.key});

  @override
  State<LogScreen> createState() => _LogScreenState();
}

class _LogScreenState extends State<LogScreen> {
  String _searchQuery = '';
  DateTime? _startDate;
  DateTime? _endDate;
  String? _filterClass;

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<RecordProvider>();
    final records = provider.filteredRecords;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Test Log'),
        actions: [
          IconButton(
            icon: const Icon(Icons.sync),
            onPressed: provider.syncInProgress ? null : () => provider.syncAllRecords(),
            tooltip: 'Sync',
          ),
        ],
      ),
      body: Column(
        children: [
          // Search + filters
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Search by record ID...',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
                contentPadding: EdgeInsets.symmetric(vertical: 8),
              ),
              onChanged: (v) {
                setState(() => _searchQuery = v.trim());
                provider.filterRecords(
                  query: v.trim(),
                  classification: _filterClass,
                  startDate: _startDate,
                  endDate: _endDate,
                );
              },
            ),
          ),
          // Filter chips
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Wrap(
              spacing: 8,
              children: [
                FilterChip(
                  label: const Text('All'),
                  selected: _filterClass == null,
                  onSelected: (s) {
                    setState(() => _filterClass = s ? null : 'positive');
                    provider.filterRecords(query: _searchQuery, classification: s ? null : _filterClass);
                  },
                ),
                FilterChip(
                  label: const Text('Positive'),
                  selected: _filterClass == 'positive',
                  onSelected: (s) {
                    setState(() => _filterClass = s ? 'positive' : null);
                    provider.filterRecords(query: _searchQuery, classification: s ? 'positive' : null);
                  },
                ),
                FilterChip(
                  label: const Text('Negative'),
                  selected: _filterClass == 'negative',
                  onSelected: (s) {
                    setState(() => _filterClass = s ? 'negative' : null);
                    provider.filterRecords(query: _searchQuery, classification: s ? 'negative' : null);
                  },
                ),
                FilterChip(
                  label: const Text('Inconclusive'),
                  selected: _filterClass == 'inconclusive',
                  onSelected: (s) {
                    setState(() => _filterClass = s ? 'inconclusive' : null);
                    provider.filterRecords(query: _searchQuery, classification: s ? 'inconclusive' : null);
                  },
                ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                await provider.loadRecords();
              },
              child: records.isEmpty
                  ? const Center(child: Text('No records found'))
                  : ListView.builder(
                      itemCount: records.length,
                      itemBuilder: (context, i) {
                        final r = records[i];
                        return Card(
                          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                          child: ListTile(
                            leading: CircleAvatar(
                              backgroundColor: r.classification == 'positive'
                                  ? Colors.red.shade100
                                  : r.classification == 'negative'
                                      ? Colors.green.shade100
                                      : Colors.amber.shade100,
                              child: Icon(
                                r.classification == 'positive'
                                    ? Icons.warning
                                    : r.classification == 'negative'
                                        ? Icons.check_circle
                                        : Icons.help_outline,
                                color: r.classification == 'positive'
                                    ? Colors.red
                                    : r.classification == 'negative'
                                        ? Colors.green
                                        : Colors.amber,
                              ),
                            ),
                            title: Text('Record ${r.id.substring(0, 8)}...'),
                            subtitle: Text(
                              '${r.timestamp.toString().substring(0, 16)} · ${r.classification} · ${r.synced ? 'Synced' : 'Pending'}',
                            ),
                            trailing: r.synced
                                ? const Icon(Icons.cloud_done, color: Colors.green, size: 18)
                                : const Icon(Icons.cloud_upload, color: Colors.orange, size: 18),
                            onTap: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => RecordDetailScreen(recordId: r.id),
                                ),
                              );
                            },
                          ),
                        );
                      },
                    ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => Navigator.of(context).pushNamed('/capture'),
        child: const Icon(Icons.add_a_photo),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: 1,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.camera_alt), label: 'Capture'),
          BottomNavigationBarItem(icon: Icon(Icons.list), label: 'Log'),
          BottomNavigationBarItem(icon: Icon(Icons.settings), label: 'Setup'),
        ],
        onTap: (i) {
          if (i == 0) Navigator.of(context).pushNamed('/capture');
          if (i == 2) Navigator.of(context).pushNamed('/setup');
        },
      ),
    );
  }
}
