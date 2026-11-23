import 'package:flutter/material.dart';

import '../../app_scope.dart';
import '../../core/arabic_text.dart';
import '../../models/academic_year.dart';
import '../../models/lecture.dart';
import '../../models/lookup.dart';
import '../../models/week_day.dart';
import '../../state/schedule_controller.dart';
import '../admin/admin_entry_screen.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/lecture_timeline.dart';
import 'share_sheet.dart';

/// الشاشة الرئيسية للطلاب (لا تحتاج تسجيل دخول).
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

  void _openShare(ScheduleController c, WeekDay day) {
    showShareSheet(context, day: day, message: c.shareMessageFor(day));
  }

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    final c = scope.schedule;
    return ListenableBuilder(
      listenable: c,
      builder: (context, _) {
        final selectedDay = c.day;
        final dayLectures =
            selectedDay == null ? const <Lecture>[] : c.lecturesForDay(selectedDay);
        return Scaffold(
          appBar: AppBar(
            titleSpacing: 16,
            title: const Row(
              children: [
                Text('👑', style: TextStyle(fontSize: 22)),
                SizedBox(width: 8),
                Text('مركز الوسيط',
                    style: TextStyle(fontWeight: FontWeight.w800)),
              ],
            ),
            actions: [
              IconButton(
                tooltip: 'تحديث الجدول',
                onPressed: c.isLoading ? null : c.load,
                icon: c.isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.refresh),
              ),
              IconButton(
                tooltip: 'لوحة الإدارة',
                icon: const Icon(Icons.admin_panel_settings_outlined),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                      builder: (_) => const AdminEntryScreen()),
                ),
              ),
            ],
          ),
          floatingActionButton: selectedDay != null && dayLectures.isNotEmpty
              ? FloatingActionButton.extended(
                  backgroundColor: const Color(0xFF1FA855),
                  foregroundColor: Colors.white,
                  onPressed: () => _openShare(c, selectedDay),
                  icon: const Icon(Icons.share),
                  label: const Text('مشاركة اليوم'),
                )
              : null,
          body: RefreshIndicator(
            color: AppColors.navy,
            onRefresh: c.load,
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(child: _Header(controller: c, search: _search)),
                ..._content(c),
                const SliverToBoxAdapter(child: SizedBox(height: 96)),
              ],
            ),
          ),
        );
      },
    );
  }

  List<Widget> _content(ScheduleController c) {
    if (c.snapshot == null) {
      if (c.isLoading) {
        return const [
          SliverFillRemaining(
            hasScrollBody: false,
            child: Center(child: CircularProgressIndicator()),
          ),
        ];
      }
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: CenteredMessage(
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
    final day = c.day;

    if (day != null) {
      final lectures = c.lecturesForDay(day);
      return [
        SliverToBoxAdapter(
          child: _DayHeading(
            day: day,
            isToday: day == c.today,
            count: lectures.length,
            onShare: lectures.isEmpty ? null : () => _openShare(c, day),
          ),
        ),
        if (lectures.isEmpty)
          SliverFillRemaining(
            hasScrollBody: false,
            child: CenteredMessage(
              icon: Icons.event_available,
              title: c.searchText.isNotEmpty
                  ? 'لا توجد نتائج مطابقة للبحث'
                  : 'لا توجد محاضرات يوم ${day.arabicName}',
              subtitle: 'جرّب يومًا آخر أو غيّر الفلاتر.',
            ),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            sliver: SliverToBoxAdapter(
              child: LectureTimeline(lectures: lectures, showYear: showYear),
            ),
          ),
      ];
    }

    // كل الأسبوع
    final counts = c.countsPerDay;
    final days = WeekDay.values.where((d) => (counts[d] ?? 0) > 0).toList();
    if (days.isEmpty) {
      return const [
        SliverFillRemaining(
          hasScrollBody: false,
          child: CenteredMessage(
            icon: Icons.search_off,
            title: 'لا توجد محاضرات مطابقة',
            subtitle: 'غيّر السنة أو القسم أو كلمة البحث.',
          ),
        ),
      ];
    }
    return [
      for (final d in days) ...[
        SliverToBoxAdapter(
          child: _DayHeading(
            day: d,
            isToday: d == c.today,
            count: counts[d] ?? 0,
            onShare: () => _openShare(c, d),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverToBoxAdapter(
            child: LectureTimeline(
                lectures: c.lecturesForDay(d), showYear: showYear),
          ),
        ),
      ],
    ];
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.controller, required this.search});

  final ScheduleController controller;
  final TextEditingController search;

  @override
  Widget build(BuildContext context) {
    final c = controller;
    final departments = c.lookups(LookupKind.department);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (!c.repository.isRemote)
          const InfoBanner(
            icon: Icons.science_outlined,
            message: 'وضع تجريبي محلي: البيانات محفوظة على هذا الهاتف فقط '
                'وغير متصلة بقاعدة البيانات المركزية.',
          ),
        if (c.isStale && c.error != null)
          InfoBanner(
            icon: Icons.wifi_off,
            color: Theme.of(context).colorScheme.error,
            message: 'تعرض آخر نسخة محفوظة. ${c.error}',
            actionLabel: 'إعادة',
            onAction: c.load,
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
          child: TextField(
            controller: search,
            onChanged: c.search,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: 'ابحث عن مادة أو مدرس',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: c.searchText.isEmpty
                  ? null
                  : IconButton(
                      tooltip: 'مسح البحث',
                      icon: const Icon(Icons.close),
                      onPressed: () {
                        search.clear();
                        c.search('');
                      },
                    ),
              filled: true,
              fillColor: Colors.white,
              contentPadding: const EdgeInsets.symmetric(vertical: 0),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: AppColors.line),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: AppColors.line),
              ),
            ),
          ),
        ),
        _ChipRow(
          children: [
            _FilterChip(
              label: AcademicYears.allLabel,
              selected: c.year == null,
              onTap: () => c.selectYear(null),
            ),
            for (final y in AcademicYears.values)
              _FilterChip(
                label: AcademicYears.name(y),
                selected: c.year == y,
                onTap: () => c.selectYear(y),
              ),
          ],
        ),
        if (c.year == AcademicYears.yearWithDepartments)
          _ChipRow(
            children: [
              _FilterChip(
                label: AcademicYears.allDepartmentsLabel,
                selected: c.departmentId == null,
                onTap: () => c.selectDepartment(null),
                gold: true,
              ),
              for (final d in departments)
                _FilterChip(
                  label: d.name,
                  selected: c.departmentId == d.id,
                  onTap: () => c.selectDepartment(d.id),
                  gold: true,
                ),
            ],
          ),
        _DaySelector(controller: c),
      ],
    );
  }
}

class _ChipRow extends StatelessWidget {
  const _ChipRow({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        itemCount: children.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) => children[i],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.gold = false,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final bool gold;

  @override
  Widget build(BuildContext context) {
    final active = gold ? AppColors.gold : AppColors.navy;
    return Material(
      color: selected ? active : Colors.white,
      shape: StadiumBorder(
        side: BorderSide(color: selected ? active : AppColors.line),
      ),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: selected
                    ? (gold ? AppColors.navy : Colors.white)
                    : AppColors.ink,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DaySelector extends StatelessWidget {
  const _DaySelector({required this.controller});

  final ScheduleController controller;

  @override
  Widget build(BuildContext context) {
    final c = controller;
    final counts = c.countsPerDay;
    final total = counts.values.fold<int>(0, (a, b) => a + b);
    final items = <Widget>[
      _DayTile(
        title: 'كل الأسبوع',
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
    required this.onShare,
  });

  final WeekDay day;
  final bool isToday;
  final int count;
  final VoidCallback? onShare;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(20, 16, 8, 8),
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
          const Spacer(),
          if (onShare != null)
            IconButton(
              tooltip: 'مشاركة مواعيد ${day.arabicName} عبر واتساب',
              onPressed: onShare,
              icon: const Icon(Icons.share, color: Color(0xFF1FA855)),
            ),
        ],
      ),
    );
  }
}
