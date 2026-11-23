import 'package:alwasit_center/models/lecture.dart';
import 'package:alwasit_center/models/week_day.dart';

int t(int h, [int m = 0]) => h * 60 + m;

Lecture lecture({
  String id = 'x',
  WeekDay day = WeekDay.tuesday,
  required int start,
  required int end,
  int year = 3,
  String subject = 'برمجة C++',
  String teacher = 'شعبان',
  String? group,
  String? departmentId,
  String? department,
}) =>
    Lecture(
      id: id,
      day: day,
      startMinutes: start,
      endMinutes: end,
      year: year,
      subjectId: 's-$subject',
      subjectName: subject,
      teacherId: 't-$teacher',
      teacherName: teacher,
      groupId: group == null ? null : 'g-$group',
      groupName: group,
      departmentId: departmentId,
      departmentName: department,
    );
