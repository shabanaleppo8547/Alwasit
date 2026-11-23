import 'package:alwasit_center/logic/schedule_filter.dart';
import 'package:alwasit_center/models/subject.dart';
import 'package:alwasit_center/models/week_day.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers.dart';

void main() {
  // عيّنة من الجدول الرسمي.
  final all = [
    lecture(id: 'lin', day: WeekDay.monday, year: 2, start: t(11), end: t(13),
        subject: 'الجبر الخطي 1'), // مشتركة A وB
    lecture(id: 'seqA', day: WeekDay.monday, year: 2, start: t(9), end: t(11),
        subject: 'المتتاليات والسلاسل التابعية', group: 'A'),
    lecture(id: 'difB', day: WeekDay.monday, year: 2, start: t(13), end: t(15),
        subject: 'المعادلات التفاضلية 1', group: 'B'),
    lecture(id: 'model', day: WeekDay.monday, year: 4, start: t(15), end: t(17),
        subject: 'النمذجة الرياضية', departmentId: 'app', department: 'التطبيقية'),
    lecture(id: 'integ', day: WeekDay.saturday, year: 4, start: t(11), end: t(13),
        subject: 'المعادلات التكاملية', departmentId: 'ana', department: 'التحليل'),
    lecture(id: 'mod', day: WeekDay.saturday, year: 3, start: t(11), end: t(12, 30),
        subject: 'نظرية المودولات', teacher: 'شعبان شحود'),
    lecture(id: 'cpp', day: WeekDay.saturday, year: 3, start: t(12, 30), end: t(14),
        subject: 'البرمجة بلغة C++', teacher: 'شعبان شحود'),
  ];

  List<String> ids(ScheduleQuery q) =>
      ScheduleFilter.apply(all, q).map((l) => l.id).toList();

  test('السنة الثانية، الفئة A، يوم الإثنين: تظهر المشتركة أيضًا', () {
    expect(ids(const ScheduleQuery(day: WeekDay.monday, year: 2, groupId: 'g-A')),
        ['seqA', 'lin']);
    expect(ids(const ScheduleQuery(day: WeekDay.monday, year: 2, groupId: 'g-B')),
        ['lin', 'difB']);
  });

  test('السنة الرابعة، قسم التطبيقية، جميع الأيام', () {
    expect(ids(const ScheduleQuery(year: 4, departmentId: 'app')), ['model']);
    expect(ids(const ScheduleQuery(year: 4)), ['integ', 'model']);
  });

  test('جميع السنوات في جميع الأيام: مرتبة حسب اليوم ثم الوقت', () {
    expect(ids(const ScheduleQuery()),
        ['mod', 'integ', 'cpp', 'seqA', 'lin', 'difB', 'model']);
  });

  test('المتزامنة تبقى كلها (السبت 11:00)', () {
    final sat =
        ScheduleFilter.apply(all, const ScheduleQuery(day: WeekDay.saturday));
    final clusters = ScheduleFilter.overlapClusters(sat);
    expect(clusters.first.map((l) => l.id).toSet(), {'integ', 'mod', 'cpp'});
    expect(clusters.expand((c) => c).length, sat.length);
  });

  test('البحث يتجاهل الهمزات والتاء المربوطة', () {
    expect(ids(const ScheduleQuery(text: 'c++')), ['cpp']);
    expect(ids(const ScheduleQuery(text: 'النمذجه')), ['model']);
  });

  group('قنوات تيليغرام', () {
    const topo = Subject(
      id: 's', name: 'التوبولوجيا العامة 1', year: 2,
      teacherId: 't', teacherName: 'شعبان شحود',
      channels: [
        Channel(groupId: null, url: 'https://t.me/shared'),
        Channel(groupId: 'B', groupName: 'B', url: 'https://t.me/b'),
        Channel(groupId: 'A', groupName: 'A', url: 'https://t.me/a', enabled: false),
      ],
    );

    test('الفئة B ترى قناتها، والفئة A (المعطّلة) ترى المشتركة', () {
      expect(ScheduleFilter.channelsFor(topo, 'B').single.url, 'https://t.me/b');
      expect(ScheduleFilter.channelsFor(topo, 'A').single.url, 'https://t.me/shared');
    });

    test('جميع الفئات: المشتركة أولًا ثم قنوات الفئات المفعّلة', () {
      expect(ScheduleFilter.channelsFor(topo, null).map((c) => c.url),
          ['https://t.me/shared', 'https://t.me/b']);
    });

    test('بلا رابط: لا أزرار مفعّلة', () {
      const empty = Subject(id: 'x', name: 'م', year: 3, teacherId: 't', teacherName: 'ي');
      expect(ScheduleFilter.channelsFor(empty, null), isEmpty);
    });

    test('المواد تظهر حسب السنة والقسم، والمشتركة بين الأقسام مع أي قسم', () {
      const subjects = [
        Subject(id: '1', name: 'النمذجة الرياضية', year: 4, departmentId: 'app',
            teacherId: 't', teacherName: 'ش'),
        Subject(id: '2', name: 'المعادلات التكاملية', year: 4, departmentId: 'ana',
            teacherId: 't', teacherName: 'ي'),
        Subject(id: '3', name: 'مشتركة', year: 4, teacherId: 't', teacherName: 'ي'),
        Subject(id: '4', name: 'الجبر الخطي 1', year: 2, teacherId: 't', teacherName: 'ش'),
      ];
      expect(ScheduleFilter.subjects(subjects, year: 4, departmentId: 'app')
          .map((s) => s.id).toSet(), {'1', '3'});
      expect(ScheduleFilter.subjects(subjects, year: 2).single.id, '4');
      expect(ScheduleFilter.subjects(subjects, text: 'نمذجة').single.id, '1');
    });
  });
}
