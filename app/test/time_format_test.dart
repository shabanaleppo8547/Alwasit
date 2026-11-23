import 'package:alwasit_center/core/time_format.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers.dart';

void main() {
  test('نظام 12 ساعة ص/م', () {
    expect(formatTime12(t(16, 30)), '4:30 م');
    expect(formatTime12(t(9, 5)), '9:05 ص');
    expect(formatTime12(t(0)), '12:00 ص');
    expect(formatTime12(t(12)), '12:00 م');
    expect(formatTime12(t(23, 59)), '11:59 م');
  });

  test('النطاق الزمني', () {
    expect(formatRange12(t(16, 30), t(19)), '4:30 - 7:00 م');
    expect(formatRange12(t(11), t(13)), '11:00 ص - 1:00 م');
    expect(formatRange12(t(8), t(9, 30)), '8:00 - 9:30 ص');
  });

  test('تحويل وقت قاعدة البيانات', () {
    expect(parseDbTime('16:30:00'), t(16, 30));
    expect(parseDbTime('09:00'), t(9));
    expect(toDbTime(t(16, 30)), '16:30');
    expect(toDbTime(t(7, 5)), '07:05');
    expect(() => parseDbTime('25:00'), throwsFormatException);
  });
}
