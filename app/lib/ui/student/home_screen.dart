import 'package:flutter/material.dart';

import '../../app_scope.dart';
import '../../core/arabic_text.dart';
import '../../logic/schedule_filter.dart';
import '../../models/week_day.dart';
import '../../state/schedule_controller.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/lecture_timeline.dart';
import '../widgets/scope_filters.dart';
import 'share_sheet.dart';
import 'shell_app_bar.dart';

/// المواعيد: فلترة حسب اليوم والسنة والفئة والقسم، مع المشاركة وPDF.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  final TextEditingController _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _search.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      AppScope.read(context).schedule.refreshIfOld();
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppScope.of(context).schedule;
    return ListenableBuilder(
      listenable: c,
      builder: (context, _) {
        final visible = c.visibleLectures;
        return Scaffold(
          appBar: shellAppBar(context, c, title: 'المواعيد'),
          floatingActionButton: c.snapshot == null
              ? null
              : FloatingActionButton.extended(
                  backgroundColor: const Color(0xFF1FA855),
                  foregroundColor: Colors.white,
                  onPressed: () => showShareSheet(context, c),
                  icon: const Icon(Icons.ios_share),
                  label: const Text('مشاركة الجدول'),
                ),
          body: RefreshIndicator(
            color: AppColors.navy,
            onRefresh: c.load,
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(child: _Header(c: c, search: _search)),
                ..._content(c, visible.length),
                const SliverToBoxAdapter(child: SizedBox(height: 96)),
              ],
            ),
          ),
        );
      },
    );
  }

  List<Widget> _content(ScheduleController c, int visibleCount) {
    if (c.snapshot == null) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: c.isLoading
              ? const Center(child: CircularProgressIndicator())
              : CenteredMessage(
                  icon: Icons.cloud_off,
                  title: 'تعذّر تحميل الجدول',
                  subtitle: c.error,
                  actionLabel: 'إعادة المحاولة',
                  onAction: c.load,
                ),
        ),
      ];
    }

    final showYear = c.year == null;
    final title = Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
      child: Text(
        '${c.titleFor(c.day)} · ${lectureCountLabel(visibleCount)}',
        style: const TextStyle(color: AppColors.muted, fontSize: 13),
      ),
    );

    if (visibleCount == 0) {
      return [
        SliverToBoxAdapter(child: title),
        const SliverFillRemaining(
          hasScrollBody: false,
          child: CenteredMessage(
            icon: Icons.event_available,
            title: 'لا توجد محاضرات ضمن الاختيارات المحددة',
            subtitle: 'جرّب يومًا آخر أو غيّر السنة أو الفئة أو القسم.',
          ),
        ),
      ];
    }

    final byDay = ScheduleFilter.byDay(c.visibleLectures);
    return [
      SliverToBoxAdapter(child: title),
      for (final entry in byDay.entries) ...[
        SliverToBoxAdapter(
          child: _DayHeading(
            day: entry.key,
            isToday: entry.key == c.today,
            count: entry.value.length,
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverToBoxAdapter(
            child: LectureTimeline(lectures: entry.value, showYear: showYear),
          ),
        ),
      ],
    ];
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.c, required this.search});

  final ScheduleController c;
  final TextEditingController search;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (c.isStale && c.error != null)
          InfoBanner(
            icon: Icons.wifi_off,
            color: Theme.of(context).colorScheme.error,
            message: 'تعرض آخر نسخة محفوظة. ${c.error}',
            actionLabel: 'إعادة',
            onAction: c.load,
          ),
        SearchBox(
          controller: search,
          hint: 'ابحث عن مادة أو أستاذ',
          onChanged: c.search,
        ),
        ScopeFilters(
          year: c.year,
          groupId: c.groupId,
          departmentId: c.departmentId,
          groups: c.groups,
          departments: c.departments,
          showGroups: c.yearHasGroups(c.year),
          showDepartments: c.yearHasDepartments(c.year),
          onYear: c.selectYear,
          onGroup: c.selectGroup,
          onDepartment: c.selectDepartment,
        ),
        _DaySelector(c: c),
      ],
    );
  }
}

class _DaySelector extends StatelessWidget {
  const _DaySelector({required this.c});

  final ScheduleController c;

  @override
  Widget build(BuildContext context) {
    final counts = c.countsPerDay;
    final total = counts.values.fold<int>(0, (a, b) => a + b);
    final items = <Widget>[
      _DayTile(
        title: 'جميع الأيام',
        count: total,
        selected: c.day == null,
        isToday: false,
        onTap: () => c.selectDay(null),
      ),
      for (final d in WeekDay.values)
        _DayTile(
          title: d.arabicName,
          count: counts[d] ?? 0,
          selected: c.day == d,
          isToday: d == c.today,
          onTap: () => c.selectDay(d),
        ),
    ];
    return Container(
      margin: const EdgeInsets.only(top: 4),
      height: 76,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) => items[i],
      ),
    );
  }
}

class _DayTile extends StatelessWidget {
  const _DayTile({
    required this.title,
    required this.count,
    required this.selected,
    required this.isToday,
    required this.onTap,
  });

  final String title;
  final int count;
  final bool selected;
  final bool isToday;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fg = selected ? Colors.white : AppColors.ink;
    return Material(
      color: selected ? AppColors.navy : Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minWidth: 74),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isToday
                  ? AppColors.gold
                  : (selected ? AppColors.navy : AppColors.line),
              width: isToday ? 2 : 1,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(title,
                  style: TextStyle(fontWeight: FontWeight.w700, color: fg)),
              const SizedBox(height: 2),
              Text(
                isToday ? 'اليوم · $count' : '$count',
                style: TextStyle(
                  fontSize: 12,
                  color: selected
                      ? AppColors.gold
                      : (count == 0 ? AppColors.muted : AppColors.navySoft),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DayHeading extends StatelessWidget {
  const _DayHeading({
    required this.day,
    required this.isToday,
    required this.count,
  });

  final WeekDay day;
  final bool isToday;
  final int count;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(20, 16, 20, 8),
      child: Row(
        children: [
          Container(
            width: 6,
            height: 26,
            decoration: BoxDecoration(
              color: AppColors.gold,
              borderRadius: BorderRadius.circular(3),
            ),
          ),
          const SizedBox(width: 10),
          Text(day.arabicName,
              style: text.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
          if (isToday) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.goldSoft,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text('اليوم',
                  style: TextStyle(
                      fontWeight: FontWeight.w700, color: AppColors.navy)),
            ),
          ],
          const SizedBox(width: 8),
          Text(lectureCountLabel(count),
              style: text.bodyMedium?.copyWith(color: AppColors.muted)),
        ],
      ),
    );
  }
}
