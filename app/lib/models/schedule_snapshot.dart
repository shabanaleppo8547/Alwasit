import 'lecture.dart';
import 'lookup.dart';
import 'subject.dart';
import 'teacher.dart';

/// نسخة كاملة من بيانات المركز في لحظة معينة (مصدر واحد لكل الأقسام).
class ScheduleSnapshot {
  const ScheduleSnapshot({
    required this.lectures,
    required this.subjects,
    required this.teachers,
    required this.groups,
    required this.departments,
    required this.fetchedAt,
  });

  final List<Lecture> lectures;
  final List<Subject> subjects;
  final List<Teacher> teachers;
  final List<LookupItem> groups;
  final List<LookupItem> departments;
  final DateTime fetchedAt;

  List<LookupItem> of(LookupKind kind) =>
      kind == LookupKind.group ? groups : departments;

  Subject? subjectById(String? id) {
    for (final s in subjects) {
      if (s.id == id) return s;
    }
    return null;
  }

  Teacher? teacherById(String? id) {
    for (final t in teachers) {
      if (t.id == id) return t;
    }
    return null;
  }

  static List<T> _list<T>(Object? raw, T Function(Map<String, dynamic>) f) =>
      ((raw as List?) ?? const [])
          .map((e) => f((e as Map).cast<String, dynamic>()))
          .toList();

  factory ScheduleSnapshot.fromJson(Map<String, dynamic> json) =>
      ScheduleSnapshot(
        fetchedAt: DateTime.parse(json['fetchedAt'] as String),
        lectures: _list(json['lectures'], Lecture.fromJson),
        subjects: _list(json['subjects'], Subject.fromJson),
        teachers: _list(json['teachers'], Teacher.fromJson),
        groups: _list(json['groups'], LookupItem.fromJson),
        departments: _list(json['departments'], LookupItem.fromJson),
      );

  Map<String, dynamic> toJson() => {
        'fetchedAt': fetchedAt.toIso8601String(),
        'lectures': lectures.map((e) => e.toJson()).toList(),
        'subjects': subjects.map((e) => e.toJson()).toList(),
        'teachers': teachers.map((e) => e.toJson()).toList(),
        'groups': groups.map((e) => e.toJson()).toList(),
        'departments': departments.map((e) => e.toJson()).toList(),
      };
}
