import 'dart:convert';
import 'dart:io';

import 'package:alwasit_center/logic/schedule_filter.dart';
import 'package:alwasit_center/logic/share_message.dart';
import 'package:alwasit_center/models/schedule_snapshot.dart';
import 'package:alwasit_center/models/week_day.dart';
import 'package:flutter_test/flutter_test.dart';

/// يقرأ ردًّا حقيقيًا ولّده الخادم من البيانات الرسمية (lib/seed.js)،
/// ويتحقق أن التطبيق يفهمه ويُنتج رسالة واتساب المعتمدة منه.
void main() {
  final snap = ScheduleSnapshot.fromJson(jsonDecode(
      File('test/fixtures/server_snapshot.json').readAsStringSync())
      as Map<String, dynamic>);

  test('التطبيق يقرأ بيانات الخادم الرسمية كاملة', () {
    expect(snap.lectures.length, 26);
    expect(snap.subjects.length, 17);
    expect(snap.teachers.map((t) => t.name), ['شعبان شحود', 'يونس شحود']);
  });

  test('رسالة الأربعاء لجميع السنوات من البيانات الحقيقية', () {
    final wed = ScheduleFilter.apply(
        snap.lectures, const ScheduleQuery(day: WeekDay.wednesday));
    final msg = ShareMessageBuilder.build(
      lectures: wed,
      day: WeekDay.wednesday,
      audience: 'لجميع السنوات',
      showYear: true,
      showDepartment: true,
      allGroupsLabel: ScopeText.groupsJoined(snap.groups),
      now: DateTime(2026, 11, 25, 18),
    );
    expect(msg, contains('*🕒 2:30 - 4:00:*\n\n*∆ النمذجة الرياضية (سنة رابعة، تطبيقية)*'));
    expect(msg, contains('*🕒 4:00 - 7:00:*\n\n*∆ البرمجة بلغة C++ (سنة ثالثة)*'));
  });

  test('السنة الثانية الفئة B يوم الإثنين: المشتركة + الخاصة بـ B', () {
    final b = snap.groups.firstWhere((g) => g.name == 'B');
    final mon = ScheduleFilter.apply(snap.lectures,
        ScheduleQuery(day: WeekDay.monday, year: 2, groupId: b.id));
    expect(mon.map((l) => l.subjectName),
        ['الجبر الخطي 1', 'المعادلات التفاضلية 1']);
  });

  test('قسم التطبيقية يرى مواده الأربع في الحضور أونلاين', () {
    final app = snap.departments.firstWhere((d) => d.name == 'التطبيقية');
    final list = ScheduleFilter.subjects(snap.subjects, year: 4, departmentId: app.id);
    expect(list.map((s) => s.name).toSet(), {
      'النمذجة الرياضية', 'ميكانيك المرونة', 'قواعد البيانات', 'البرمجة بلغة بايثون',
    });
    expect(list.every((s) => s.teacherName == 'شعبان شحود'), isTrue);
  });
}
