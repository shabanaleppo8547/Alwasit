import 'package:flutter/material.dart';

import '../../app_scope.dart';
import '../../core/arabic_text.dart';
import '../../core/time_format.dart';
import '../../logic/schedule_filter.dart';
import '../../models/academic_year.dart';
import '../../models/lecture.dart';
import '../../models/subject.dart';
import '../../models/teacher.dart';
import '../../models/week_day.dart';
import '../../state/schedule_controller.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/lecture_timeline.dart';
import '../widgets/scope_filters.dart';
import 'lecture_form_screen.dart';
import 'lookups_tab.dart';
import 'subject_form_screen.dart';
import 'teacher_form_screen.dart';

class AdminDashboardScreen extends StatelessWidget {
  const AdminDashboardScreen({super.key, required this.onSignedOut});

  final VoidCallback onSignedOut;

  Future<void> _signOut(BuildContext context) async {
    final scope = AppScope.read(context);
    final ok = await runWithFeedback(
      context,
      scope.repository.signOut,
      success: 'تم تسجيل الخروج',
    );
    if (ok) onSignedOut();
  }

  @override
  Widget build(BuildContext context) {
    final c = AppScope.of(context).schedule;
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('لوحة الإدارة'),
          actions: [
            ListenableBuilder(
              listenable: c,
              builder: (context, _) => IconButton(
                tooltip: 'تحديث',
                onPressed: c.isLoading ? null : c.load,
                icon: const Icon(Icons.refresh),
              ),
            ),
            IconButton(
              tooltip: 'تسجيل الخروج',
              icon: const Icon(Icons.logout),
              onPressed: () => _signOut(context),
            ),
          ],
          bottom: const TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            labelColor: AppColors.gold,
            unselectedLabelColor: Colors.white70,
            indicatorColor: AppColors.gold,
            tabs: [
              Tab(icon: Icon(Icons.event_note), text: 'المواعيد'),
              Tab(icon: Icon(Icons.menu_book), text: 'المواد والقنوات'),
              Tab(icon: Icon(Icons.person), text: 'الأساتذة'),
              Tab(icon: Icon(Icons.category), text: 'الفئات والأقسام'),
            ],
          ),
        ),
        body: const TabBarView(
          children: [_LecturesTab(), _SubjectsTab(), _TeachersTab(), LookupsTab()],
        ),
      ),
    );
  }
}

Widget _errorBanner(BuildContext context, ScheduleController c) => c.error == null
    ? const SizedBox.shrink()
    : InfoBanner(
        icon: Icons.warning_amber,
        color: Theme.of(context).colorScheme.error,
        message: c.error!,
        actionLabel: 'إعادة',
        onAction: c.load,
      );

// ======================= المواعيد =======================

class _LecturesTab extends StatefulWidget {
  const _LecturesTab();

  @override
  State<_LecturesTab> createState() => _LecturesTabState();
}

class _LecturesTabState extends State<_LecturesTab> {
  WeekDay? _day;
  int? _year;

  Future<void> _openForm({Lecture? lecture}) => Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) =>
              LectureFormScreen(existing: lecture, initialDay: lecture?.day ?? _day),
        ),
      );

  Future<void> _delete(ScheduleController c, Lecture l) async {
    final yes = await confirm(
      context,
      title: 'حذف الموعد؟',
      message: '${l.subjectName} — ${l.teacherName}\n'
          'يوم ${l.day.arabicName}، ${formatRange12(l.startMinutes, l.endMinutes)}\n'
          '${AcademicYears.name(l.year)}\n\n'
          'سيختفي من جدول الطلاب ورسائل واتساب وPDF فورًا.',
    );
    if (!yes || !mounted) return;
    final ok = await runWithFeedback(
      context,
      () => c.repository.deleteLecture(l.id),
      success: 'تم حذف الموعد',
    );
    if (ok) await c.load();
  }

  @override
  Widget build(BuildContext context) {
    final c = AppScope.of(context).schedule;
    return ListenableBuilder(
      listenable: c,
      builder: (context, _) {
        final lectures = ScheduleFilter.apply(
            c.allLectures, ScheduleQuery(day: _day, year: _year));
        final byDay = ScheduleFilter.byDay(lectures);
        return Scaffold(
          floatingActionButton: FloatingActionButton.extended(
            onPressed: () => _openForm(),
            icon: const Icon(Icons.add),
            label: const Text('موعد جديد'),
          ),
          body: RefreshIndicator(
            onRefresh: c.load,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.only(bottom: 96),
              children: [
                _errorBanner(context, c),
                ChipRow(children: [
                  FilterPill(
                      label: 'جميع الأيام',
                      selected: _day == null,
                      onTap: () => setState(() => _day = null)),
                  for (final d in WeekDay.values)
                    FilterPill(
                        label: d.arabicName,
                        selected: _day == d,
                        onTap: () => setState(() => _day = d)),
                ]),
                ChipRow(children: [
                  FilterPill(
                      label: AcademicYears.allLabel,
                      selected: _year == null,
                      gold: true,
                      onTap: () => setState(() => _year = null)),
                  for (final y in AcademicYears.values)
                    FilterPill(
                        label: AcademicYears.name(y),
                        selected: _year == y,
                        gold: true,
                        onTap: () => setState(() => _year = y)),
                ]),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
                  child: Text(
                    'المعروض: ${lectureCountLabel(lectures.length)} '
                    '(الإجمالي ${c.allLectures.length})',
                    style: const TextStyle(color: AppColors.muted),
                  ),
                ),
                if (c.snapshot == null && c.isLoading)
                  const Padding(
                    padding: EdgeInsets.all(48),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (lectures.isEmpty)
                  const CenteredMessage(
                    icon: Icons.event_busy,
                    title: 'لا توجد مواعيد هنا',
                    subtitle: 'اضغط «موعد جديد» للإضافة.',
                  )
                else
                  for (final entry in byDay.entries) ...[
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
                      child: Text(
                        '${entry.key.arabicName} · ${lectureCountLabel(entry.value.length)}',
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: LectureTimeline(
                        lectures: entry.value,
                        showYear: true,
                        trailingBuilder: (l) => _EditDeleteMenu(
                          onEdit: () => _openForm(lecture: l),
                          onDelete: () => _delete(c, l),
                        ),
                      ),
                    ),
                  ],
              ],
            ),
          ),
        );
      },
    );
  }
}

class _EditDeleteMenu extends StatelessWidget {
  const _EditDeleteMenu({required this.onEdit, required this.onDelete});

  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      tooltip: 'خيارات',
      onSelected: (v) {
        if (v == 'edit') {
          onEdit();
        } else {
          onDelete();
        }
      },
      itemBuilder: (_) => const [
        PopupMenuItem(
          value: 'edit',
          child: ListTile(
            leading: Icon(Icons.edit_outlined),
            title: Text('تعديل'),
          ),
        ),
        PopupMenuItem(
          value: 'delete',
          child: ListTile(
            leading: Icon(Icons.delete_outline, color: Colors.red),
            title: Text('حذف'),
          ),
        ),
      ],
    );
  }
}

// ======================= المواد =======================

class _SubjectsTab extends StatelessWidget {
  const _SubjectsTab();

  Future<void> _delete(BuildContext context, ScheduleController c, Subject s) async {
    final uses = c.allLectures.where((l) => l.subjectId == s.id).length;
    if (uses > 0) {
      showMessage(context,
          'لا يمكن حذف «${s.name}» لأن لها ${lectureCountLabel(uses)}. احذف مواعيدها أولًا.',
          error: true);
      return;
    }
    final yes = await confirm(context,
        title: 'حذف المادة؟',
        message: '«${s.name}» ستختفي من الحضور أونلاين أيضًا.');
    if (!yes || !context.mounted) return;
    final ok = await runWithFeedback(context, () => c.repository.deleteSubject(s.id),
        success: 'تم حذف المادة');
    if (ok) await c.load();
  }

  @override
  Widget build(BuildContext context) {
    final c = AppScope.of(context).schedule;
    void open([Subject? s]) => Navigator.of(context).push(MaterialPageRoute<void>(
        builder: (_) => SubjectFormScreen(existing: s)));
    return ListenableBuilder(
      listenable: c,
      builder: (context, _) {
        final subjects = ScheduleFilter.subjects(c.subjects);
        return Scaffold(
          floatingActionButton: FloatingActionButton.extended(
            onPressed: () => open(),
            icon: const Icon(Icons.add),
            label: const Text('مادة جديدة'),
          ),
          body: RefreshIndicator(
            onRefresh: c.load,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 96),
              children: [
                _errorBanner(context, c),
                for (final y in AcademicYears.values) ...[
                  Padding(
                    padding: const EdgeInsets.fromLTRB(8, 12, 8, 6),
                    child: Text(AcademicYears.name(y),
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.w800)),
                  ),
                  if (!subjects.any((s) => s.year == y))
                    const Padding(
                      padding: EdgeInsets.fromLTRB(8, 0, 8, 8),
                      child: Text('لا توجد مواد بعد — جاهزة للإضافة.',
                          style: TextStyle(color: AppColors.muted)),
                    ),
                  for (final s in subjects.where((s) => s.year == y))
                    Card(
                      elevation: 0,
                      color: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: const BorderSide(color: AppColors.line),
                      ),
                      child: ListTile(
                        onTap: () => open(s),
                        title: Text(s.name,
                            style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text([
                          'الأستاذ ${s.teacherName}',
                          if (s.departmentName != null) 'قسم ${s.departmentName}',
                          _channelStatus(s),
                        ].join(' · ')),
                        trailing: _EditDeleteMenu(
                          onEdit: () => open(s),
                          onDelete: () => _delete(context, c, s),
                        ),
                      ),
                    ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  static String _channelStatus(Subject s) {
    final usable = s.channels.where((c) => c.isUsable).length;
    if (usable == 0) {
      return s.channels.isEmpty ? 'بلا رابط قناة' : 'القناة معطّلة';
    }
    return usable == 1 ? 'رابط قناة ✓' : '$usable روابط قنوات ✓';
  }
}

// ======================= الأساتذة =======================

class _TeachersTab extends StatelessWidget {
  const _TeachersTab();

  Future<void> _delete(BuildContext context, ScheduleController c, Teacher t) async {
    final uses = c.subjects.where((s) => s.teacherId == t.id).length;
    if (uses > 0) {
      showMessage(context,
          'لا يمكن حذف الأستاذ ${t.name} لأنه مسؤول عن $uses من المواد. انقلها لأستاذ آخر أولًا.',
          error: true);
      return;
    }
    final yes = await confirm(context,
        title: 'حذف الأستاذ؟', message: 'سيختفي من قسم التواصل.');
    if (!yes || !context.mounted) return;
    final ok = await runWithFeedback(context, () => c.repository.deleteTeacher(t.id),
        success: 'تم حذف الأستاذ');
    if (ok) await c.load();
  }

  @override
  Widget build(BuildContext context) {
    final c = AppScope.of(context).schedule;
    void open([Teacher? t]) => Navigator.of(context).push(MaterialPageRoute<void>(
        builder: (_) => TeacherFormScreen(existing: t)));
    return ListenableBuilder(
      listenable: c,
      builder: (context, _) => Scaffold(
        floatingActionButton: FloatingActionButton.extended(
          onPressed: () => open(),
          icon: const Icon(Icons.person_add),
          label: const Text('أستاذ جديد'),
        ),
        body: RefreshIndicator(
          onRefresh: c.load,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 96),
            children: [
              _errorBanner(context, c),
              const Padding(
                padding: EdgeInsets.all(8),
                child: Text(
                  'هذه حسابات الأساتذة الشخصية (قسم التواصل)، وهي منفصلة عن قنوات المواد.',
                  style: TextStyle(color: AppColors.muted),
                ),
              ),
              for (final t in c.teachers)
                Card(
                  elevation: 0,
                  color: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: const BorderSide(color: AppColors.line),
                  ),
                  child: ListTile(
                    onTap: () => open(t),
                    title: Text(t.name,
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text(
                      '${c.subjects.where((s) => s.teacherId == t.id).length} مادة · '
                      '${t.contacts.map((x) => x.displayLabel).join('، ')}',
                    ),
                    trailing: _EditDeleteMenu(
                      onEdit: () => open(t),
                      onDelete: () => _delete(context, c, t),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
