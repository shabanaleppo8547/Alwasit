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
import '../models/week_day.dart';

/// حالة الجدول المشتركة بين شاشة الطلاب ولوحة الإدارة.
///
/// الطرفان يقرآن من نفس المستودع، وأي تعديل من الإدارة يتبعه
/// إعادة تحميل فورية فيظهر للطلاب مباشرة.
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
      _isStale = true; // ستُستبدل بعد أول تحميل ناجح.
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
  String? _departmentId;
  String _text = '';

  // ---------- القراءة ----------

  ScheduleSnapshot? get snapshot => _snapshot;
  bool get isLoading => _loading;

  /// true إذا كانت البيانات المعروضة نسخة محفوظة قديمة (فشل التحديث).
  bool get isStale => _isStale;
  String? get error => _error;

  WeekDay? get day => _day;
  int? get year => _year;
  String? get departmentId => _departmentId;
  String get searchText => _text;

  WeekDay get today => WeekDay.fromDate(_clock());

  List<LookupItem> lookups(LookupKind kind) =>
      _snapshot?.of(kind) ?? const [];

  ScheduleQuery get query => ScheduleQuery(
        day: _day,
        year: _year,
        departmentId: _departmentId,
        text: _text,
      );

  List<Lecture> get allLectures => _snapshot?.lectures ?? const [];

  /// المحاضرات الظاهرة حسب كل الفلاتر.
  List<Lecture> get visibleLectures => ScheduleFilter.apply(allLectures, query);

  /// عدد المحاضرات في كل يوم حسب الفلاتر الحالية (بغض النظر عن اليوم المختار).
  Map<WeekDay, int> get countsPerDay {
    final all = ScheduleFilter.apply(allLectures, query.withDay(null));
    final counts = <WeekDay, int>{};
    for (final l in all) {
      counts[l.day] = (counts[l.day] ?? 0) + 1;
    }
    return counts;
  }

  List<Lecture> lecturesForDay(WeekDay day) =>
      ScheduleFilter.apply(allLectures, query.withDay(day));

  String shareMessageFor(WeekDay day) => ShareMessageBuilder.buildDay(
        day: day,
        lectures: lecturesForDay(day),
        includeYear: _year == null,
      );

  // ---------- الفلاتر ----------

  void selectDay(WeekDay? day) {
    if (_day == day) return;
    _day = day;
    notifyListeners();
  }

  void selectYear(int? year) {
    if (_year == year) return;
    _year = year;
    if (year != AcademicYears.yearWithDepartments) _departmentId = null;
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

  /// يجلب أحدث بيانات. عند الفشل يُبقي آخر نسخة ويعرض سبب الخطأ.
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
      _dropMissingDepartment();
    } catch (e) {
      _error = AppException.from(e).message;
      if (_snapshot != null) _isStale = true;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// تحديث تلقائي عند العودة للتطبيق إذا مضت مدة على آخر تحديث.
  Future<void> refreshIfOld({Duration maxAge = const Duration(minutes: 2)}) {
    final last = _snapshot?.fetchedAt;
    if (last == null || _isStale || _clock().difference(last) > maxAge) {
      return load();
    }
    return Future.value();
  }

  void _dropMissingDepartment() {
    final id = _departmentId;
    if (id == null) return;
    final exists = lookups(LookupKind.department).any((d) => d.id == id);
    if (!exists) _departmentId = null;
  }
}
