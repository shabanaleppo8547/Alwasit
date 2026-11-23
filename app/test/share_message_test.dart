import 'package:alwasit_center/logic/share_message.dart';
import 'package:alwasit_center/models/week_day.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers.dart';

void main() {
  test('رسالة يوم الثلاثاء بالتنسيق المعتمد', () {
    final msg = ShareMessageBuilder.buildDay(
      day: WeekDay.tuesday,
      lectures: [lecture(start: t(16, 30), end: t(19))],
      includeYear: false,
    );
    expect(
      msg,
      '🟡 *مواعيد يوم الثلاثاء*\n'
      'في:\n'
      '👑 *مركز الوسيط* 👑\n'
      '\n'
      '🕒 *4:30 - 7:00 م*:\n'
      '∆ برمجة C++',
    );
  });

  test('المحاضرات المتزامنة لا تُحذف وتظهر تحت نفس الوقت', () {
    final msg = ShareMessageBuilder.buildDay(
      day: WeekDay.sunday,
      lectures: [
        lecture(
            id: '1', day: WeekDay.sunday, start: t(10), end: t(12),
            subject: 'مادة أ', group: 'A'),
        lecture(
            id: '2', day: WeekDay.sunday, start: t(10), end: t(12),
            subject: 'مادة ب', group: 'B'),
        lecture(
            id: '3', day: WeekDay.sunday, start: t(13), end: t(14),
            year: 4, subject: 'مادة ج', department: 'الجبر',
            departmentId: 'd1'),
      ],
      includeYear: false,
    );
    expect(msg, contains('🕒 *10:00 ص - 12:00 م*:\n∆ مادة أ (فئة A)\n∆ مادة ب (فئة B)'));
    expect(msg, contains('🕒 *1:00 - 2:00 م*:\n∆ مادة ج (الجبر)'));
  });

  test('إضافة السنة عند مشاركة جميع السنوات', () {
    final msg = ShareMessageBuilder.buildDay(
      day: WeekDay.tuesday,
      lectures: [lecture(start: t(16, 30), end: t(19))],
      includeYear: true,
    );
    expect(msg, endsWith('∆ برمجة C++ (السنة الثالثة)'));
  });

  test('يوم بلا محاضرات', () {
    final msg = ShareMessageBuilder.buildDay(
        day: WeekDay.friday, lectures: const [], includeYear: false);
    expect(msg, endsWith('لا توجد محاضرات في هذا اليوم.'));
  });
}
