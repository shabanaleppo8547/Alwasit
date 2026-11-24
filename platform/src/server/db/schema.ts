// مخطط قاعدة البيانات لمنصة مركز الوسيط.
//
// المبادئ:
// - كل الهيكل الأكاديمي (السنوات، الأقسام/الفئات، المواد، المحاضرات) بيانات تُدار من لوحة الإدارة.
// - رابط الفيديو (video_ref) لا يُرسل أبدًا إلى المتصفح؛ يُقرأ فقط داخل مسار البث بعد التحقق من الصلاحية.
// - صلاحية المشاهدة = اشتراك (enrollment) فعّال على مادة كاملة أو على حزمة محاضرات.
// - رموز التفعيل تُنشئ اشتراكات، ولا تُعطي صلاحية بحد ذاتها.

import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---------- الحسابات ----------

/** teacher محجوز لمرحلة لاحقة (لوحة المدرس). */
export const userRole = pgEnum('user_role', ['student', 'teacher', 'admin']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(), // يُخزَّن بحروف صغيرة دائمًا
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  role: userRole('role').notNull().default('student'),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** الجلسات: نخزّن بصمة SHA-256 للرمز فقط، والرمز نفسه في كوكي httpOnly. */
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** الجهاز المعتمد الذي أُنشئت منه الجلسة (فارغ للمدير). إلغاء اعتماد الجهاز يبطل الجلسة فورًا. */
    deviceId: uuid('device_id').references((): AnyPgColumn => devices.id, { onDelete: 'cascade' }),
    /** آخر إثبات لامتلاك مفتاح الجهاز صالح حتى هذا الوقت (عمر قصير، يُجدَّد تلقائيًا). */
    proofExpiresAt: timestamp('proof_expires_at', { withTimezone: true }),
    /** وقت انتهاء فتح لوحة الإدارة بكلمة مرور الإدارة لهذه الجلسة. */
    adminUnlockedUntil: timestamp('admin_unlocked_until', { withTimezone: true }),
    userAgent: text('user_agent'),
    ip: text('ip'),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

// ---------- ربط الحساب بجهاز واحد ----------

export const devicePlatform = pgEnum('device_platform', ['web', 'android', 'ios']);
export const deviceStatus = pgEnum('device_status', ['active', 'revoked']);

/**
 * الأجهزة المعتمدة. كل جهاز يُعرَّف بمفتاح عام (ECDSA P-256)، ومفتاحه الخاص لا يغادر الجهاز.
 * جهاز واحد فعّال فقط لكل حساب (فهرس فريد جزئي).
 */
export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SPKI بصيغة base64url */
    publicKey: text('public_key').notNull(),
    /** SHA-256 للمفتاح العام */
    keyId: text('key_id').notNull(),
    platform: devicePlatform('platform').notNull().default('web'),
    label: text('label'),
    userAgent: text('user_agent'),
    status: deviceStatus('status').notNull().default('active'),
    /** من وافق على هذا الجهاز (فارغ = اعتماد تلقائي عند أول تسجيل). */
    approvedById: uuid('approved_by_id').references(() => users.id, { onDelete: 'set null' }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedById: uuid('revoked_by_id').references(() => users.id, { onDelete: 'set null' }),
    revokeReason: text('revoke_reason'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('devices_one_active_per_user').on(t.userId).where(sql`${t.status} = 'active'`),
    index('devices_user_idx').on(t.userId),
  ],
);

export const deviceRequestStatus = pgEnum('device_request_status', ['pending', 'approved', 'rejected', 'superseded']);

/** طلبات نقل الحساب إلى جهاز جديد؛ تُنشأ فقط بعد كلمة مرور صحيحة وتوقيع من مفتاح الجهاز الجديد. */
export const deviceRequests = pgTable(
  'device_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    publicKey: text('public_key').notNull(),
    keyId: text('key_id').notNull(),
    platform: devicePlatform('platform').notNull().default('web'),
    label: text('label'),
    userAgent: text('user_agent'),
    ip: text('ip'),
    status: deviceRequestStatus('status').notNull().default('pending'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decidedById: uuid('decided_by_id').references(() => users.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('device_requests_one_pending').on(t.userId).where(sql`${t.status} = 'pending'`),
    index('device_requests_status_idx').on(t.status, t.createdAt),
  ],
);

/** تحديات لمرة واحدة لإثبات امتلاك مفتاح الجهاز (عمرها دقيقتان). */
export const deviceChallenges = pgTable('device_challenges', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

/**
 * تراخيص التشغيل دون اتصال (للتطبيق الأصلي لاحقًا). كل ترخيص مرتبط بجهاز ومحاضرة،
 * ومدته لا تتجاوز 7 أيام من آخر تجديد. إلغاء الجهاز يلغي تراخيصه على الخادم فورًا،
 * لكن الجهاز غير المتصل يبقى قادرًا على التشغيل حتى انتهاء مدة ترخيصه المخزّن.
 */
export const offlineLicenses = pgTable(
  'offline_licenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    lectureId: uuid('lecture_id')
      .notNull()
      .references(() => lectures.id, { onDelete: 'cascade' }),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [index('offline_licenses_device_idx').on(t.deviceId)],
);

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: text('id').primaryKey(), // بصمة SHA-256 للرمز
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: createdAt(),
});

// ---------- الهيكل الأكاديمي ----------

export const years = pgTable('years', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  isPublished: boolean('is_published').notNull().default(true),
  createdAt: createdAt(),
});

/** group = فئة (A، B) ، department = قسم (الجبر، التحليل، التطبيقية). */
export const sectionKind = pgEnum('section_kind', ['group', 'department']);

export const sections = pgTable(
  'sections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    yearId: uuid('year_id')
      .notNull()
      .references(() => years.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    kind: sectionKind('kind').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('sections_year_idx').on(t.yearId)],
);

export type TeacherContact = { type: 'whatsapp' | 'telegram' | 'facebook' | 'phone' | 'other'; value: string };

export const teachers = pgTable('teachers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  title: text('title'), // مثال: مدرس الجبر والتحليل
  bio: text('bio'),
  contacts: jsonb('contacts').$type<TeacherContact[]>().notNull().default([]),
  /** ربط مستقبلي بحساب مدرس (role = teacher). */
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  sortOrder: integer('sort_order').notNull().default(0),
  isPublished: boolean('is_published').notNull().default(true),
  createdAt: createdAt(),
});

export const subjects = pgTable(
  'subjects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    yearId: uuid('year_id')
      .notNull()
      .references(() => years.id, { onDelete: 'restrict' }),
    /** فارغ = المادة مشتركة لكل السنة. */
    sectionId: uuid('section_id').references(() => sections.id, { onDelete: 'restrict' }),
    teacherId: uuid('teacher_id').references(() => teachers.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description'),
    /** نص حر لطريقة الاشتراك أو السعر، فالدفع خارج المنصة حاليًا. */
    priceNote: text('price_note'),
    sortOrder: integer('sort_order').notNull().default(0),
    isPublished: boolean('is_published').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('subjects_year_idx').on(t.yearId), index('subjects_section_idx').on(t.sectionId)],
);

export const lectures = pgTable(
  'lectures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').notNull().default(0),
    durationSeconds: integer('duration_seconds'),
    /**
     * مرجع الفيديو الخاص. لا يُرسل للمتصفح أبدًا.
     * local:<file>  ملف داخل private-media (للمحتوى التجريبي)
     * https://...   رابط خاص يُمرَّر عبر الخادم
     * لاحقًا: bunny:<id> / mux:<id> مع روابط موقّعة وDRM.
     */
    videoRef: text('video_ref'),
    /** محاضرة مجانية لأي طالب مسجّل (معاينة). */
    isFree: boolean('is_free').notNull().default(false),
    isPublished: boolean('is_published').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('lectures_subject_idx').on(t.subjectId, t.sortOrder)],
);

/** حزمة = مجموعة محاضرات من مادة تُباع منفصلة عن المادة الكاملة. */
export const bundles = pgTable('bundles', {
  id: uuid('id').primaryKey().defaultRandom(),
  subjectId: uuid('subject_id')
    .notNull()
    .references(() => subjects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  createdAt: createdAt(),
});

export const bundleLectures = pgTable(
  'bundle_lectures',
  {
    bundleId: uuid('bundle_id')
      .notNull()
      .references(() => bundles.id, { onDelete: 'cascade' }),
    lectureId: uuid('lecture_id')
      .notNull()
      .references(() => lectures.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.bundleId, t.lectureId] })],
);

// ---------- الاشتراكات والتفعيل ----------

export const enrollmentStatus = pgEnum('enrollment_status', ['active', 'revoked']);
export const enrollmentSource = pgEnum('enrollment_source', ['admin', 'code']);

export const enrollments = pgTable(
  'enrollments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subjectId: uuid('subject_id').references(() => subjects.id, { onDelete: 'cascade' }),
    bundleId: uuid('bundle_id').references(() => bundles.id, { onDelete: 'cascade' }),
    status: enrollmentStatus('status').notNull().default('active'),
    source: enrollmentSource('source').notNull(),
    activatedAt: timestamp('activated_at', { withTimezone: true }).notNull().defaultNow(),
    /** فارغ = بلا انتهاء. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    grantedById: uuid('granted_by_id').references(() => users.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('enrollments_one_target', sql`(${t.subjectId} is null) <> (${t.bundleId} is null)`),
    uniqueIndex('enrollments_user_subject_uq').on(t.userId, t.subjectId).where(sql`${t.subjectId} is not null`),
    uniqueIndex('enrollments_user_bundle_uq').on(t.userId, t.bundleId).where(sql`${t.bundleId} is not null`),
    index('enrollments_user_idx').on(t.userId),
  ],
);

export const codeBatches = pgTable(
  'code_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    subjectId: uuid('subject_id').references(() => subjects.id, { onDelete: 'cascade' }),
    bundleId: uuid('bundle_id').references(() => bundles.id, { onDelete: 'cascade' }),
    /** عدد الطلاب الذين يمكنهم استخدام كل رمز (عادة 1). */
    maxUsesPerCode: integer('max_uses_per_code').notNull().default(1),
    /** مدة الصلاحية بالأيام بعد التفعيل؛ فارغ = بلا انتهاء. */
    accessDays: integer('access_days'),
    /** آخر موعد لاستخدام الرموز. */
    redeemBefore: timestamp('redeem_before', { withTimezone: true }),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [check('code_batches_one_target', sql`(${t.subjectId} is null) <> (${t.bundleId} is null)`)],
);

export const activationCodes = pgTable(
  'activation_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => codeBatches.id, { onDelete: 'cascade' }),
    code: text('code').notNull().unique(),
    usesCount: integer('uses_count').notNull().default(0),
    isDisabled: boolean('is_disabled').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('activation_codes_batch_idx').on(t.batchId)],
);

export const codeRedemptions = pgTable(
  'code_redemptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    codeId: uuid('code_id')
      .notNull()
      .references(() => activationCodes.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    enrollmentId: uuid('enrollment_id').references(() => enrollments.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('code_redemptions_code_user_uq').on(t.codeId, t.userId)],
);

// ---------- البنية المساندة ----------

/** عدّاد محاولات لكل مفتاح (IP أو بريد) يعمل على أكثر من خادم. */
export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  resetAt: timestamp('reset_at', { withTimezone: true }).notNull(),
});

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'cascade' }),
    details: jsonb('details').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index('audit_logs_target_idx').on(t.targetUserId)],
);

export type User = typeof users.$inferSelect;
export type Year = typeof years.$inferSelect;
export type Section = typeof sections.$inferSelect;
export type Teacher = typeof teachers.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type Lecture = typeof lectures.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type Device = typeof devices.$inferSelect;
export type DeviceRequest = typeof deviceRequests.$inferSelect;
