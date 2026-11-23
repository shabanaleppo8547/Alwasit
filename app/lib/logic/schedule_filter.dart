import '../core/arabic_text.dart';
import '../models/academic_year.dart';
import '../models/lecture.dart';
import '../models/lookup.dart';
import '../models/subject.dart';
import '../models/week_day.dart';

/// اختيارات الطالب: اليوم والسنة والفئة والقسم والبحث.
class ScheduleQuery {
  const ScheduleQuery({
    this.day,
    this.year,
    this.groupId,
    this.departmentId,
    this.text = '',
  });

  /// null = جميع الأيام.
  final WeekDay? day;

  /// null = جميع السنوات.
  final int? year;

  /// null = جميع الفئات. المحاضرات المشتركة تظهر مع أي فئة.
  final String? groupId;

  /// null = جميع الأقسام. المحاضرات بلا قسم تظهر مع أي قسم.
  final String? departmentId;

  final String text;

  ScheduleQuery withDay(WeekDay? newDay) => ScheduleQuery(
        day: newDay,
        year: year,
        groupId: groupId,
        departmentId: departmentId,
        text: text,
      );
}

/// محاضرات تشترك في نفس وقت البداية والنهاية.
class TimeSlot {
  TimeSlot(this.startMinutes, this.endMinutes, this.lectures);

  final int startMinutes;
  final int endMinutes;
  final List<Lecture> lectures;
}

/// منطق الفلترة والترتيب والتجميع (بدون واجهة، ومُختبر).
class ScheduleFilter {
  const ScheduleFilter._();

  static int compare(Lecture a, Lecture b) {
    var c = a.day.index.compareTo(b.day.index);
    if (c != 0) return c;
    c = a.startMinutes.compareTo(b.startMinutes);
    if (c != 0) return c;
    c = a.endMinutes.compareTo(b.endMinutes);
    if (c != 0) return c;
    c = a.year.compareTo(b.year);
    if (c != 0) return c;
    c = (a.groupName ?? '').compareTo(b.groupName ?? '');
    if (c != 0) return c;
    return a.subjectName.compareTo(b.subjectName);
  }

  static List<Lecture> apply(Iterable<Lecture> lectures, ScheduleQuery q) {
    final needle = normalizeArabic(q.text);
    return lectures.where((l) {
      if (q.day != null && l.day != q.day) return false;
      if (q.year != null && l.year != q.year) return false;
      if (q.groupId != null && l.groupId != null && l.groupId != q.groupId) {
        return false;
      }
      if (q.departmentId != null &&
          l.departmentId != null &&
          l.departmentId != q.departmentId) {
        return false;
      }
      if (needle.isNotEmpty &&
          !normalizeArabic(l.subjectName).contains(needle) &&
          !normalizeArabic(l.teacherName).contains(needle)) {
        return false;
      }
      return true;
    }).toList()
      ..sort(compare);
  }

  static Map<WeekDay, List<Lecture>> byDay(List<Lecture> sorted) {
    final map = <WeekDay, List<Lecture>>{};
    for (final l in sorted) {
      map.putIfAbsent(l.day, () => []).add(l);
    }
    return map;
  }

  /// مجموعات المحاضرات المتداخلة زمنيًا داخل يوم واحد (لا تُحذف أيٌّ منها).
  static List<List<Lecture>> overlapClusters(List<Lecture> sortedSameDay) {
    final clusters = <List<Lecture>>[];
    var clusterEnd = -1;
    for (final l in sortedSameDay) {
      if (clusters.isNotEmpty && l.startMinutes < clusterEnd) {
        clusters.last.add(l);
        if (l.endMinutes > clusterEnd) clusterEnd = l.endMinutes;
      } else {
        clusters.add([l]);
        clusterEnd = l.endMinutes;
      }
    }
    return clusters;
  }

  /// مجموعات بنفس وقت البداية والنهاية.
  static List<TimeSlot> exactSlots(List<Lecture> sortedSameDay) {
    final slots = <TimeSlot>[];
    for (final l in sortedSameDay) {
      if (slots.isNotEmpty &&
          slots.last.startMinutes == l.startMinutes &&
          slots.last.endMinutes == l.endMinutes) {
        slots.last.lectures.add(l);
      } else {
        slots.add(TimeSlot(l.startMinutes, l.endMinutes, [l]));
      }
    }
    return slots;
  }

  /// مواد «الحضور أونلاين» حسب السنة والقسم والبحث.
  /// المادة تظهر مرة واحدة مهما كان عدد فئاتها.
  static List<Subject> subjects(
    Iterable<Subject> all, {
    int? year,
    String? departmentId,
    String text = '',
  }) {
    final needle = normalizeArabic(text);
    final list = all.where((s) {
      if (year != null && s.year != year) return false;
      if (departmentId != null &&
          s.departmentId != null &&
          s.departmentId != departmentId) {
        return false;
      }
      if (needle.isNotEmpty &&
          !normalizeArabic(s.name).contains(needle) &&
          !normalizeArabic(s.teacherName).contains(needle)) {
        return false;
      }
      return true;
    }).toList()
      ..sort((a, b) {
        final c = a.year.compareTo(b.year);
        if (c != 0) return c;
        final d = (a.departmentName ?? '').compareTo(b.departmentName ?? '');
        if (d != 0) return d;
        return a.name.compareTo(b.name);
      });
    return list;
  }

  /// القنوات التي تظهر للطالب حسب فئته.
  /// - فئة محددة: قناة فئته إن وُجدت، وإلا القناة المشتركة.
  /// - جميع الفئات: القناة المشتركة ثم قنوات الفئات.
  static List<Channel> channelsFor(Subject s, String? groupId) {
    final usable = s.channels.where((c) => c.isUsable).toList();
    if (groupId != null) {
      for (final c in usable) {
        if (c.groupId == groupId) return [c];
      }
      return usable.where((c) => c.groupId == null).toList();
    }
    usable.sort((a, b) {
      if (a.groupId == null) return -1;
      if (b.groupId == null) return 1;
      return (a.groupName ?? '').compareTo(b.groupName ?? '');
    });
    return usable;
  }
}

/// وصف نطاق الاختيارات بالعربية (للعناوين والرسائل وPDF).
class ScopeText {
  const ScopeText._();

  /// «لجميع السنوات» / «للسنة الثانية، الفئة A» / «للسنة الرابعة، قسم التطبيقية»
  static String audience({
    required int? year,
    required String? groupName,
    required String? departmentName,
    required bool yearHasGroups,
    String search = '',
  }) {
    String s;
    if (year == null) {
      s = 'لجميع السنوات';
    } else {
      s = 'لل${AcademicYears.name(year).substring(2)}';
      if (year == AcademicYears.yearWithDepartments) {
        s += departmentName == null
            ? '، ${AcademicYears.allDepartmentsLabel}'
            : '، قسم $departmentName';
      } else if (yearHasGroups) {
        s += groupName == null
            ? '، ${AcademicYears.allGroupsLabel}'
            : '، الفئة $groupName';
      }
    }
    if (search.trim().isNotEmpty) s += '، بحث: «${search.trim()}»';
    return s;
  }

  /// «يوم الأربعاء» / «جميع الأيام»
  static String days(WeekDay? day) =>
      day == null ? 'جميع الأيام' : 'يوم ${day.arabicName}';

  static String groupsJoined(List<LookupItem> groups) =>
      groups.map((g) => g.name).join(' و');
}
