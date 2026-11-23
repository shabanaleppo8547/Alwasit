import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../app_scope.dart';
import '../../core/arabic_text.dart';
import '../../logic/schedule_filter.dart';
import '../../models/academic_year.dart';
import '../../models/subject.dart';
import '../../state/schedule_controller.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/scope_filters.dart';
import 'shell_app_bar.dart';

/// 🎥 الحضور أونلاين: المادة ← قناتها على تيليغرام.
/// المواد تظهر كلها حتى لو لم يكن لها موعد حضوري.
class OnlineScreen extends StatefulWidget {
  const OnlineScreen({super.key});

  @override
  State<OnlineScreen> createState() => _OnlineScreenState();
}

class _OnlineScreenState extends State<OnlineScreen> {
  final _search = TextEditingController();
  int? _year;
  String? _groupId;
  String? _departmentId;
  String _text = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _selectYear(ScheduleController c, int? y) {
    setState(() {
      _year = y;
      if (!c.yearHasGroups(y)) _groupId = null;
      if (!c.yearHasDepartments(y)) _departmentId = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = AppScope.of(context).schedule;
    return ListenableBuilder(
      listenable: c,
      builder: (context, _) {
        final subjects = ScheduleFilter.subjects(
          c.subjects,
          year: _year,
          departmentId: _departmentId,
          text: _text,
        );
        return Scaffold(
          appBar: shellAppBar(context, c, title: 'الحضور أونلاين'),
          body: RefreshIndicator(
            onRefresh: c.load,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.only(bottom: 32),
              children: [
                const Padding(
                  padding: EdgeInsets.fromLTRB(20, 16, 20, 0),
                  child: Text(
                    '🎥 اختر سنتك وفئتك أو قسمك، ثم ادخل إلى قناة المادة على تيليغرام.',
                    style: TextStyle(color: AppColors.muted, height: 1.4),
                  ),
                ),
                SearchBox(
                  controller: _search,
                  hint: 'ابحث عن مادة',
                  onChanged: (v) => setState(() => _text = v),
                ),
                ScopeFilters(
                  year: _year,
                  groupId: _groupId,
                  departmentId: _departmentId,
                  groups: c.groups,
                  departments: c.departments,
                  showGroups: c.yearHasGroups(_year),
                  showDepartments: c.yearHasDepartments(_year),
                  onYear: (y) => _selectYear(c, y),
                  onGroup: (g) => setState(() => _groupId = g),
                  onDepartment: (d) => setState(() => _departmentId = d),
                ),
                const SizedBox(height: 8),
                if (c.snapshot == null && c.isLoading)
                  const Padding(
                    padding: EdgeInsets.all(48),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (subjects.isEmpty)
                  CenteredMessage(
                    icon: Icons.menu_book_outlined,
                    title: _text.isNotEmpty
                        ? 'لا توجد مادة بهذا الاسم'
                        : 'لا توجد مواد هنا بعد',
                    subtitle: _text.isNotEmpty
                        ? null
                        : 'ستظهر المواد فور إضافتها من لوحة الإدارة.',
                  )
                else
                  for (final s in subjects)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                      child: _SubjectCard(
                        subject: s,
                        channels: ScheduleFilter.channelsFor(s, _groupId),
                        groupSelected: _groupId != null,
                      ),
                    ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _SubjectCard extends StatelessWidget {
  const _SubjectCard({
    required this.subject,
    required this.channels,
    required this.groupSelected,
  });

  final Subject subject;
  final List<Channel> channels;
  final bool groupSelected;

  Future<void> _open(BuildContext context, String url) async {
    final uri = Uri.tryParse(url);
    var ok = false;
    if (uri != null) {
      try {
        ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
      } catch (_) {
        ok = false;
      }
    }
    if (!ok && context.mounted) {
      showMessage(context, 'تعذّر فتح الرابط. تأكد من وجود تيليغرام أو متصفح.',
          error: true);
    }
  }

  String _buttonLabel(Channel ch) {
    if (groupSelected || ch.groupId == null || channels.length == 1) {
      return 'الانتقال إلى قناة المادة';
    }
    return 'قناة الفئة ${ch.groupName ?? ''}';
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final s = subject;
    final scope = [
      AcademicYears.name(s.year),
      if (s.departmentName != null) 'قسم ${s.departmentName}',
    ].join(' · ');
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(bidiSafe(s.name),
              style: text.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800, color: AppColors.ink)),
          const SizedBox(height: 4),
          Text(scope, style: text.bodySmall?.copyWith(color: AppColors.muted)),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.person_outline, size: 18, color: AppColors.muted),
              const SizedBox(width: 4),
              Text('الأستاذ ${s.teacherName}',
                  style: text.bodyMedium?.copyWith(color: AppColors.navySoft)),
            ],
          ),
          const SizedBox(height: 12),
          if (channels.isEmpty) ...[
            FilledButton.icon(
              onPressed: null,
              icon: const Icon(Icons.telegram),
              label: const Text('الانتقال إلى قناة المادة'),
            ),
            const SizedBox(height: 6),
            const Text('رابط القناة سيُضاف قريبًا',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.muted)),
          ] else
            for (final ch in channels)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF229ED9),
                    minimumSize: const Size.fromHeight(46),
                  ),
                  onPressed: () => _open(context, ch.url),
                  icon: const Icon(Icons.telegram),
                  label: Text(_buttonLabel(ch)),
                ),
              ),
        ],
      ),
    );
  }
}
