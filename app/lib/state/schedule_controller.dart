import 'package:flutter/foundation.dart';

import '../core/app_exception.dart';
import '../data/schedule_cache.dart';
import '../data/schedule_repository.dart';
import '../logic/schedule_filter.dart';
import '../logic/share_message.dart';
import '../models/academic_year.dart';
import '../models/lecture.dart';
import '../models/lookup.dart';
import '../models/schedule_snapshot.dart';
import '../models/subject.dart';
import '../models/teacher.dart';
import '../models/week_day.dart';

/// حالة البيانات المشتركة بين كل أقسام التطبيق ولوحة الإدارة.
/// أي تعديل من الإدارة يتبعه تحميل فوري فيظهر في كل مكان.
class ScheduleController extends ChangeNotifier {
  ScheduleController({
    required this.repository,
    required this.cache,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now {
    _day = WeekDay.fromDate(_clock());
    final cached = cache.read();
    if (cached != null) {
      _snapshot = cached;
      _isStale = true;
    }
  }

  final ScheduleRepository repository;
  final ScheduleCache cache;
  final DateTime Function() _clock;

  ScheduleSnapshot? _snapshot;
  bool _loading = false;
  bool _isStale = false;
  String? _error;

  WeekDay? _day;
  int? _year;
  String? _groupId;
  String? _departmentId;
  String _text = '';

  // ---------- البيانات ----------

  ScheduleSnapshot? get snapshot => _snapshot;
  bool get isLoading => _loading;
  bool get isStale => _isStale;
  String? get error => _error;

  List<Lecture> get allLectures => _snapshot?.lectures ?? const [];
  List<Subject> get subjects => _snapshot?.subjects ?? const [];
  List<Teacher> get teachers => _snapshot?.teachers ?? const [];
  List<LookupItem> get groups => _snapshot?.groups ?? const [];
  List<LookupItem> get departments => _snapshot?.departments ?? const [];
  List<LookupItem> lookups(LookupKind kind) =>
      kind == LookupKind.group ? groups : departments;

  WeekDay get today => WeekDay.fromDate(_clock());

  String? nameOf(List<LookupItem> list, String? id) {
    if (id == null) return null;
    for (final x in list) {
      if (x.id == id) return x.name;
    }
    return null;
  }

  /// تظهر اختيارات الفئات لهذه السنة؟ (الثانية دائمًا، وغيرها إن استُخدمت)
  bool yearHasGroups(int? year) {
    if (year == null || !AcademicYears.allowsGroups(year)) return false;
    if (year == AcademicYears.yearWithGroups) return groups.isNotEmpty;
    return allLectures.any((l) => l.year == year && l.groupId != null) ||
        subjects.any(
            (s) => s.year == year && s.channels.any((c) => c.groupId != null));
  }

  bool yearHasDepartments(int? year) =>
      year == AcademicYears.yearWithDepartments;

  // ---------- فلاتر المواعيد ----------

  WeekDay? get day => _day;
  int? get year => _year;
  String? get groupId => _groupId;
  String? get departmentId => _departmentId;
  String get searchText => _text;

  ScheduleQuery get query => ScheduleQuery(
        day: _day,
        year: _year,
        groupId: _groupId,
        departmentId: _departmentId,
        text: _text,
      );

  List<Lecture> get visibleLectures => ScheduleFilter.apply(allLectures, query);

  Map<WeekDay, int> get countsPerDay {
    final counts = <WeekDay, int>{};
    for (final l in ScheduleFilter.apply(allLectures, query.withDay(null))) {
      counts[l.day] = (counts[l.day] ?? 0) + 1;
    }
    return counts;
  }

  List<Lecture> lecturesForDay(WeekDay day) =>
      ScheduleFilter.apply(allLectures, query.withDay(day));

  /// «للسنة الثانية، الفئة A»
  String get audienceText => ScopeText.audience(
        year: _year,
        groupName: nameOf(groups, _groupId),
        departmentName: nameOf(departments, _departmentId),
        yearHasGroups: yearHasGroups(_year),
        search: _text,
      );

  /// عنوان الجدول المعروض: «مواعيد يوم الأربعاء – لجميع السنوات»
  String titleFor(WeekDay? day) => 'مواعيد ${ScopeText.days(day)} – $audienceText';

  /// رسالة واتساب للجدول المعروض (يوم محدد أو كل الأيام).
  String shareMessage({WeekDay? day, bool useSelectedDay = true}) {
    final d = useSelectedDay ? _day : day;
    return ShareMessageBuilder.build(
      lectures: ScheduleFilter.apply(allLectures, query.withDay(d)),
      day: d,
      audience: audienceText,
      showYear: _year == null,
      showDepartment: _departmentId == null,
      allGroupsLabel: ScopeText.groupsJoined(groups),
      now: _clock(),
    );
  }

  void selectDay(WeekDay? day) {
    if (_day == day) return;
    _day = day;
    notifyListeners();
  }

  void selectYear(int? year) {
    if (_year == year) return;
    _year = year;
    if (!yearHasGroups(year)) _groupId = null;
    if (!yearHasDepartments(year)) _departmentId = null;
    notifyListeners();
  }

  void selectGroup(String? id) {
    if (_groupId == id) return;
    _groupId = id;
    notifyListeners();
  }

  void selectDepartment(String? id) {
    if (_departmentId == id) return;
    _departmentId = id;
    notifyListeners();
  }

  void search(String text) {
    if (_text == text) return;
    _text = text;
    notifyListeners();
  }

  // ---------- التحميل ----------

  Future<void> load() async {
    if (_loading) return;
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final fresh = await repository.fetchAll();
      _snapshot = fresh;
      _isStale = false;
      await cache.save(fresh);
      if (nameOf(groups, _groupId) == null) _groupId = null;
      if (nameOf(departments, _departmentId) == null) _departmentId = null;
    } catch (e) {
      _error = AppException.from(e).message;
      if (_snapshot != null) _isStale = true;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> refreshIfOld({Duration maxAge = const Duration(minutes: 2)}) {
    final last = _snapshot?.fetchedAt;
    if (last == null || _isStale || _clock().difference(last) > maxAge) {
      return load();
    }
    return Future.value();
  }
}
