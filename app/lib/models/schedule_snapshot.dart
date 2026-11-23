import 'lecture.dart';
import 'lookup.dart';

/// نسخة كاملة من بيانات الجدول في لحظة معينة.
class ScheduleSnapshot {
  const ScheduleSnapshot({
    required this.lectures,
    required this.lookups,
    required this.fetchedAt,
  });

  final List<Lecture> lectures;
  final Map<LookupKind, List<LookupItem>> lookups;
  final DateTime fetchedAt;

  List<LookupItem> of(LookupKind kind) => lookups[kind] ?? const [];

  Map<String, dynamic> toJson() => {
        'fetchedAt': fetchedAt.toIso8601String(),
        'lectures': lectures.map((l) => l.toJson()).toList(),
        'lookups': {
          for (final kind in LookupKind.values)
            kind.name: of(kind).map((e) => e.toJson()).toList(),
        },
      };

  factory ScheduleSnapshot.fromJson(Map<String, dynamic> json) {
    final rawLookups = (json['lookups'] as Map?)?.cast<String, dynamic>() ?? {};
    return ScheduleSnapshot(
      fetchedAt: DateTime.parse(json['fetchedAt'] as String),
      lectures: (json['lectures'] as List)
          .map((e) => Lecture.fromJson((e as Map).cast<String, dynamic>()))
          .toList(),
      lookups: {
        for (final kind in LookupKind.values)
          kind: ((rawLookups[kind.name] as List?) ?? const [])
              .map((e) => LookupItem.fromJson((e as Map).cast<String, dynamic>()))
              .toList(),
      },
    );
  }
}
