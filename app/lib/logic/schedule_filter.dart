import '../core/arabic_text.dart';
import '../models/academic_year.dart';
import '../models/lecture.dart';
import '../models/week_day.dart';

/// معايير العرض التي يختارها الطالب.
class ScheduleQuery {
  const ScheduleQuery({
    this.day,
    this.year,
    this.departmentId,
    this.text = '',
  });

  /// null = كل أيام الأسبوع.
  final WeekDay? day;

  /// null = جميع السنوات.
  final int? year;

  /// null = جميع الأقسام. يُطبَّق فقط عند اختيار السنة الرابعة.
  final String? departmentId;

  /// بحث في اسم المادة أو المدرس.
  final String text;

  ScheduleQuery withDay(WeekDay? newDay) => ScheduleQuery(
        day: newDay,
        year: year,
        departmentId: departmentId,
        text: text,
      );
}

/// محاضرات تشترك في نفس وقت البداية والنهاية.
class TimeSlot {
  const TimeSlot(this.startMinutes, this.endMinutes, this.lectures);

  final int startMinutes;
  final int endMinutes;
  final List<Lecture> lectures;
}

/// منطق الفلترة والترتيب والتجميع (بدون أي واجهة، قابل للاختبار).
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
    final applyDepartment =
        q.year == AcademicYears.yearWithDepartments && q.departmentId != null;

    final result = lectures.where((l) {
      if (q.day != null && l.day != q.day) return false;
      if (q.year != null && l.year != q.year) return false;
      // محاضرة بلا قسم = مشتركة بين كل أقسام السنة الرابعة، فتظهر دائمًا.
      if (applyDepartment &&
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
    return result;
  }

  /// تجميع حسب اليوم مع الحفاظ على ترتيب الأيام.
  static Map<WeekDay, List<Lecture>> byDay(List<Lecture> sorted) {
    final map = <WeekDay, List<Lecture>>{};
    for (final l in sorted) {
      map.putIfAbsent(l.day, () => []).add(l);
    }
    return map;
  }

  /// مجموعات المحاضرات المتداخلة زمنيًا داخل يوم واحد.
  /// كل محاضرة تبقى ظاهرة؛ التجميع فقط لتوضيح التزامن.
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

  /// مجموعات بنفس وقت البداية والنهاية (تُستخدم في رسالة واتساب).
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
}
