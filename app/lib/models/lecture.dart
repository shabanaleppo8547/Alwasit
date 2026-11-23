import 'week_day.dart';

/// محاضرة كما تُعرض للطالب (بالأسماء الكاملة).
class Lecture {
  const Lecture({
    required this.id,
    required this.day,
    required this.startMinutes,
    required this.endMinutes,
    required this.year,
    required this.subjectId,
    required this.subjectName,
    required this.teacherId,
    required this.teacherName,
    this.groupId,
    this.groupName,
    this.departmentId,
    this.departmentName,
    this.notes,
  });

  final String id;
  final WeekDay day;

  /// الوقت بالدقائق منذ منتصف الليل.
  final int startMinutes;
  final int endMinutes;

  /// 1 إلى 4.
  final int year;

  final String subjectId;
  final String subjectName;
  final String teacherId;
  final String teacherName;

  /// null = المحاضرة لكل الفئات.
  final String? groupId;
  final String? groupName;

  /// null = لكل الأقسام (أو سنة بلا أقسام).
  final String? departmentId;
  final String? departmentName;

  final String? notes;

  bool overlaps(Lecture other) =>
      day == other.day &&
      startMinutes < other.endMinutes &&
      other.startMinutes < endMinutes;

  LectureDraft toDraft() => LectureDraft(
        id: id,
        day: day,
        startMinutes: startMinutes,
        endMinutes: endMinutes,
        year: year,
        subjectId: subjectId,
        teacherId: teacherId,
        groupId: groupId,
        departmentId: departmentId,
        notes: notes,
      );

  factory Lecture.fromJson(Map<String, dynamic> j) => Lecture(
        id: j['id'] as String,
        day: WeekDay.fromKey(j['day'] as String),
        startMinutes: j['start'] as int,
        endMinutes: j['end'] as int,
        year: j['year'] as int,
        subjectId: j['subjectId'] as String,
        subjectName: j['subjectName'] as String,
        teacherId: j['teacherId'] as String,
        teacherName: j['teacherName'] as String,
        groupId: j['groupId'] as String?,
        groupName: j['groupName'] as String?,
        departmentId: j['departmentId'] as String?,
        departmentName: j['departmentName'] as String?,
        notes: j['notes'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'day': day.key,
        'start': startMinutes,
        'end': endMinutes,
        'year': year,
        'subjectId': subjectId,
        'subjectName': subjectName,
        'teacherId': teacherId,
        'teacherName': teacherName,
        'groupId': groupId,
        'groupName': groupName,
        'departmentId': departmentId,
        'departmentName': departmentName,
        'notes': notes,
      };
}

/// بيانات محاضرة عند الإضافة أو التعديل (بالمعرّفات فقط).
class LectureDraft {
  const LectureDraft({
    this.id,
    required this.day,
    required this.startMinutes,
    required this.endMinutes,
    required this.year,
    required this.subjectId,
    required this.teacherId,
    this.groupId,
    this.departmentId,
    this.notes,
  });

  /// null عند الإضافة.
  final String? id;
  final WeekDay day;
  final int startMinutes;
  final int endMinutes;
  final int year;
  final String subjectId;
  final String teacherId;
  final String? groupId;
  final String? departmentId;
  final String? notes;

  LectureDraft withId(String newId) => LectureDraft(
        id: newId,
        day: day,
        startMinutes: startMinutes,
        endMinutes: endMinutes,
        year: year,
        subjectId: subjectId,
        teacherId: teacherId,
        groupId: groupId,
        departmentId: departmentId,
        notes: notes,
      );

  factory LectureDraft.fromJson(Map<String, dynamic> j) => LectureDraft(
        id: j['id'] as String?,
        day: WeekDay.fromKey(j['day'] as String),
        startMinutes: j['start'] as int,
        endMinutes: j['end'] as int,
        year: j['year'] as int,
        subjectId: j['subjectId'] as String,
        teacherId: j['teacherId'] as String,
        groupId: j['groupId'] as String?,
        departmentId: j['departmentId'] as String?,
        notes: j['notes'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'day': day.key,
        'start': startMinutes,
        'end': endMinutes,
        'year': year,
        'subjectId': subjectId,
        'teacherId': teacherId,
        'groupId': groupId,
        'departmentId': departmentId,
        'notes': notes,
      };
}
