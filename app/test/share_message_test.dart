import 'package:alwasit_center/core/arabic_text.dart';
import 'package:alwasit_center/logic/schedule_filter.dart';
import 'package:alwasit_center/logic/share_message.dart';
import 'package:alwasit_center/models/week_day.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers.dart';

final _evening = DateTime(2026, 11, 25, 18);

void main() {
  test('مثال يوم الأربعاء لجميع السنوات مطابق حرفيًا للتنسيق المعتمد', () {
    final msg = ShareMessageBuilder.build(
      lectures: [
        lecture(
            day: WeekDay.wednesday, start: t(16), end: t(19), year: 3,
            subject: 'البرمجة بلغة C++'),
        lecture(
            day: WeekDay.wednesday, start: t(14, 30), end: t(16), year: 4,
            subject: 'النمذجة الرياضية', departmentId: 'd', department: 'التطبيقية'),
      ],
      day: WeekDay.wednesday,
      audience: 'لجميع السنوات',
      showYear: true,
      showDepartment: true,
      allGroupsLabel: 'A وB',
      now: _evening,
    );
    expect(
      msg.replaceAll('\u200E', ''),
      '*مساء الخير جميعاً😍*\n\n'
      '*🟡 مواعيد يوم الأربعاء*\n\n'
      '*لجميع السنوات*\n\n'
      '*في:*\n\n'
      '*👑 مركز الوسيط 👑*\n\n'
      '*🕒 2:30 - 4:00:*\n\n'
      '*∆ النمذجة الرياضية (سنة رابعة، تطبيقية)*\n\n'
      '*🕒 4:00 - 7:00:*\n\n'
      '*∆ البرمجة بلغة C++ (سنة ثالثة)*\n\n'
      '*بالتوفيق للجميع❤️*',
    );
  });

  test('C++ لا تنقلب داخل النص العربي', () {
    expect(bidiSafe('البرمجة بلغة C++'), 'البرمجة بلغة C++\u200E');
    expect(bidiSafe(bidiSafe('C#')), 'C#\u200E');
    expect(bidiSafe('البرمجة بلغة بايثون'), 'البرمجة بلغة بايثون');
  });

  test('صباحًا تتغير التحية', () {
    final msg = ShareMessageBuilder.build(
      lectures: const [], day: WeekDay.friday, audience: 'للسنة الأولى',
      showYear: false, showDepartment: true, allGroupsLabel: '',
      now: DateTime(2026, 11, 27, 9),
    );
    expect(msg, startsWith('*صباح الخير جميعاً😍*'));
    expect(msg, contains('*لا توجد محاضرات ضمن الاختيارات المحددة*'));
  });

  test('جميع الأيام: الرسالة مقسمة حسب الأيام، والمتزامنة كلها موجودة', () {
    final msg = ShareMessageBuilder.build(
      lectures: [
        lecture(id: '1', day: WeekDay.monday, start: t(11), end: t(13), year: 2,
            subject: 'الجبر الخطي 1'),
        lecture(id: '2', day: WeekDay.sunday, start: t(9), end: t(11), year: 2,
            subject: 'المعادلات التفاضلية 1', group: 'A'),
        lecture(id: '3', day: WeekDay.sunday, start: t(9), end: t(11), year: 2,
            subject: 'مادة متزامنة', group: 'B'),
      ],
      day: null,
      audience: 'للسنة الثانية، جميع الفئات',
      showYear: false,
      showDepartment: true,
      allGroupsLabel: 'A وB',
      now: _evening,
    );
    expect(msg, contains('*🟡 مواعيد جميع الأيام*'));
    final sun = msg.indexOf('*📅 يوم الأحد*');
    final mon = msg.indexOf('*📅 يوم الإثنين*');
    expect(sun, greaterThan(0));
    expect(mon, greaterThan(sun));
    expect(msg, contains('*∆ المعادلات التفاضلية 1 (فئة A)*\n\n*∆ مادة متزامنة (فئة B)*'));
    expect(msg, contains('*∆ الجبر الخطي 1 (A وB)*'));
  });

  test('عناوين النطاق لكل التركيبات', () {
    String a(int? y, {String? g, String? d, bool groups = false}) =>
        ScopeText.audience(
            year: y, groupName: g, departmentName: d, yearHasGroups: groups);
    expect(a(null), 'لجميع السنوات');
    expect(a(1), 'للسنة الأولى');
    expect(a(2, groups: true), 'للسنة الثانية، جميع الفئات');
    expect(a(2, g: 'A', groups: true), 'للسنة الثانية، الفئة A');
    expect(a(3), 'للسنة الثالثة');
    expect(a(4), 'للسنة الرابعة، جميع الأقسام');
    expect(a(4, d: 'التطبيقية'), 'للسنة الرابعة، قسم التطبيقية');
    expect(ScopeText.days(null), 'جميع الأيام');
    expect(ScopeText.days(WeekDay.monday), 'يوم الإثنين');
  });
}
