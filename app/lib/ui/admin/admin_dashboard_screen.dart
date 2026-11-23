import 'package:flutter/material.dart';

import '../../app_scope.dart';
import '../../core/arabic_text.dart';
import '../../core/time_format.dart';
import '../../logic/schedule_filter.dart';
import '../../models/academic_year.dart';
import '../../models/lecture.dart';
import '../../models/week_day.dart';
import '../../state/schedule_controller.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/lecture_timeline.dart';
import 'lecture_form_screen.dart';
import 'lookups_tab.dart';

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
      length: 2,
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
            labelColor: AppColors.gold,
            unselectedLabelColor: Colors.white70,
            indicatorColor: AppColors.gold,
            tabs: [
              Tab(icon: Icon(Icons.event_note), text: 'المحاضرات'),
              Tab(icon: Icon(Icons.list_alt), text: 'المواد والمدرسون'),
            ],
          ),
        ),
        body: const TabBarView(
          children: [_LecturesTab(), LookupsTab()],
        ),
      ),
    );
  }
}

class _LecturesTab extends StatefulWidget {
  const _LecturesTab();

  @override
  State<_LecturesTab> createState() => _LecturesTabState();
}

class _LecturesTabState extends State<_LecturesTab> {
  WeekDay? _day;
  int? _year;

  Future<void> _openForm({Lecture? lecture}) async {
    await Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => LectureFormScreen(
        existing: lecture,
        initialDay: lecture?.day ?? _day,
        initialYear: lecture?.year ?? _year,
      ),
    ));
  }

  Future<void> _delete(ScheduleController c, Lecture l) async {
    final yes = await confirm(
      context,
      title: 'حذف المحاضرة؟',
      message: '${l.subjectName} — ${l.teacherName}\n'
          'يوم ${l.day.arabicName}، ${formatRange12(l.startMinutes, l.endMinutes)}\n'
          '${AcademicYears.name(l.year)}\n\n'
          'ستختفي من جدول الطلاب فورًا.',
    );
    if (!yes || !mounted) return;
    final ok = await runWithFeedback(
      context,
      () => c.repository.deleteLecture(l.id),
      success: 'تم حذف المحاضرة',
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
          c.allLectures,
          ScheduleQuery(day: _day, year: _year),
        );
        final byDay = ScheduleFilter.byDay(lectures);
        return Scaffold(
          floatingActionButton: FloatingActionButton.extended(
            onPressed: () => _openForm(),
            icon: const Icon(Icons.add),
            label: const Text('محاضرة جديدة'),
          ),
          body: RefreshIndicator(
            onRefresh: c.load,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.only(bottom: 96),
              children: [
                if (c.error != null)
                  InfoBanner(
                    icon: Icons.warning_amber,
                    color: Theme.of(context).colorScheme.error,
                    message: c.error!,
                    actionLabel: 'إعادة',
                    onAction: c.load,
                  ),
                _Filters(
                  day: _day,
                  year: _year,
                  onDay: (d) => setState(() => _day = d),
                  onYear: (y) => setState(() => _year = y),
                ),
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
                    title: 'لا توجد محاضرات هنا',
                    subtitle: 'اضغط «محاضرة جديدة» لإضافة محاضرة.',
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
                        trailingBuilder: (l) => PopupMenuButton<String>(
                          tooltip: 'خيارات',
                          onSelected: (v) {
                            if (v == 'edit') _openForm(lecture: l);
                            if (v == 'delete') _delete(c, l);
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
                                leading: Icon(Icons.delete_outline,
                                    color: Colors.red),
                                title: Text('حذف'),
                              ),
                            ),
                          ],
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

class _Filters extends StatelessWidget {
  const _Filters({
    required this.day,
    required this.year,
    required this.onDay,
    required this.onYear,
  });

  final WeekDay? day;
  final int? year;
  final ValueChanged<WeekDay?> onDay;
  final ValueChanged<int?> onYear;

  @override
  Widget build(BuildContext context) {
    Widget chip(String label, bool selected, VoidCallback onTap) => Padding(
          padding: const EdgeInsetsDirectional.only(end: 8),
          child: ChoiceChip(
            label: Text(label),
            selected: selected,
            onSelected: (_) => onTap(),
          ),
        );

    return Column(
      children: [
        SizedBox(
          height: 52,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            children: [
              chip('كل الأيام', day == null, () => onDay(null)),
              for (final d in WeekDay.values)
                chip(d.arabicName, day == d, () => onDay(d)),
            ],
          ),
        ),
        SizedBox(
          height: 52,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            children: [
              chip(AcademicYears.allLabel, year == null, () => onYear(null)),
              for (final y in AcademicYears.values)
                chip(AcademicYears.name(y), year == y, () => onYear(y)),
            ],
          ),
        ),
      ],
    );
  }
}
