import 'package:flutter/material.dart';

import '../../models/academic_year.dart';
import '../../models/lookup.dart';
import '../theme.dart';

/// صفوف اختيار السنة ثم الفئة (للسنة الثانية) أو القسم (للسنة الرابعة).
class ScopeFilters extends StatelessWidget {
  const ScopeFilters({
    super.key,
    required this.year,
    required this.groupId,
    required this.departmentId,
    required this.groups,
    required this.departments,
    required this.showGroups,
    required this.showDepartments,
    required this.onYear,
    required this.onGroup,
    required this.onDepartment,
  });

  final int? year;
  final String? groupId;
  final String? departmentId;
  final List<LookupItem> groups;
  final List<LookupItem> departments;
  final bool showGroups;
  final bool showDepartments;
  final ValueChanged<int?> onYear;
  final ValueChanged<String?> onGroup;
  final ValueChanged<String?> onDepartment;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ChipRow(children: [
          FilterPill(
            label: AcademicYears.allLabel,
            selected: year == null,
            onTap: () => onYear(null),
          ),
          for (final y in AcademicYears.values)
            FilterPill(
              label: AcademicYears.name(y),
              selected: year == y,
              onTap: () => onYear(y),
            ),
        ]),
        if (showGroups)
          ChipRow(children: [
            FilterPill(
              label: AcademicYears.allGroupsLabel,
              selected: groupId == null,
              onTap: () => onGroup(null),
              gold: true,
            ),
            for (final g in groups)
              FilterPill(
                label: 'الفئة ${g.name}',
                selected: groupId == g.id,
                onTap: () => onGroup(g.id),
                gold: true,
              ),
          ]),
        if (showDepartments)
          ChipRow(children: [
            FilterPill(
              label: AcademicYears.allDepartmentsLabel,
              selected: departmentId == null,
              onTap: () => onDepartment(null),
              gold: true,
            ),
            for (final d in departments)
              FilterPill(
                label: 'قسم ${d.name}',
                selected: departmentId == d.id,
                onTap: () => onDepartment(d.id),
                gold: true,
              ),
          ]),
      ],
    );
  }
}

class ChipRow extends StatelessWidget {
  const ChipRow({super.key, required this.children});

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

class FilterPill extends StatelessWidget {
  const FilterPill({
    super.key,
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

/// حقل بحث موحّد.
class SearchBox extends StatelessWidget {
  const SearchBox({
    super.key,
    required this.controller,
    required this.hint,
    required this.onChanged,
  });

  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: const BorderSide(color: AppColors.line),
    );
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: ValueListenableBuilder<TextEditingValue>(
        valueListenable: controller,
        builder: (context, value, _) => TextField(
          controller: controller,
          onChanged: onChanged,
          textInputAction: TextInputAction.search,
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: const Icon(Icons.search),
            suffixIcon: value.text.isEmpty
                ? null
                : IconButton(
                    tooltip: 'مسح البحث',
                    icon: const Icon(Icons.close),
                    onPressed: () {
                      controller.clear();
                      onChanged('');
                    },
                  ),
            filled: true,
            fillColor: Colors.white,
            contentPadding: EdgeInsets.zero,
            border: border,
            enabledBorder: border,
          ),
        ),
      ),
    );
  }
}
