import 'package:alwasit_center/logic/schedule_filter.dart';
import 'package:alwasit_center/models/week_day.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers.dart';

void main() {
  final all = [
    lecture(id: 'cpp', start: t(16, 30), end: t(19)),
    lecture(
        id: 'alg', year: 4, start: t(9), end: t(11),
        subject: 'جبر خطي', teacher: 'أحمد',
        departmentId: 'd-alg', department: 'الجبر'),
    lecture(
        id: 'ana', year: 4, start: t(9), end: t(11),
        subject: 'تحليل عقدي', teacher: 'سامر',
        departmentId: 'd-ana', department: 'التحليل'),
    lecture(
        id: 'common', year: 4, start: t(12), end: t(13),
        subject: 'مادة مشتركة', teacher: 'ليلى'),
    lecture(
        id: 'sun', day: WeekDay.sunday, year: 1, start: t(8), end: t(9),
        subject: 'تفاضل', teacher: 'علي', group: 'A'),
  ];

  List<String> ids(ScheduleQuery q) =>
      ScheduleFilter.apply(all, q).map((l) => l.id).toList();

  test('فلترة اليوم والسنة', () {
    expect(ids(const ScheduleQuery(day: WeekDay.sunday)), ['sun']);
    expect(ids(const ScheduleQuery(day: WeekDay.tuesday, year: 3)), ['cpp']);
    expect(ids(const ScheduleQuery(year: 4)).toSet(), {'alg', 'ana', 'common'});
  });

  test('قسم السنة الرابعة يُظهر المحاضرات المشتركة أيضًا', () {
    expect(ids(const ScheduleQuery(year: 4, departmentId: 'd-alg')),
        ['alg', 'common']);
  });

  test('البحث يتجاهل الهمزات والتاء المربوطة', () {
    expect(ids(const ScheduleQuery(text: 'احمد')), ['alg']);
    expect(ids(const ScheduleQuery(text: 'c++')), ['cpp']);
    expect(ids(const ScheduleQuery(text: 'ليلي')), ['common']);
  });

  test('المحاضرات المتزامنة تبقى كلها ضمن مجموعة واحدة', () {
    final tuesday =
        ScheduleFilter.apply(all, const ScheduleQuery(day: WeekDay.tuesday));
    final clusters = ScheduleFilter.overlapClusters(tuesday);
    expect(clusters.map((c) => c.length).toList(), [2, 1, 1]);
    expect(clusters.expand((c) => c).length, tuesday.length);
  });
}
