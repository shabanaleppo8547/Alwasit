// البيانات الرسمية الأولى لمركز الوسيط، تُحمَّل مرة واحدة عند أول تشغيل.
// بعدها كل التعديلات تتم من لوحة الإدارة.
//
// الوقت هنا بنظام 24 ساعة: 4:30 مساءً = '16:30'.
// group: null = محاضرة مشتركة بين الفئتين A وB.
// ⚠️ روابط قنوات تيليغرام للمواد تُترك فارغة؛ صاحب المركز يضيفها من لوحة الإدارة.

export const SEED = {
  groups: ['A', 'B'],
  departments: ['الجبر', 'التحليل', 'التطبيقية'],

  teachers: [
    {
      name: 'شعبان شحود',
      contacts: [
        { type: 'whatsapp', value: '963935350049' },
        { type: 'telegram', value: 'https://t.me/shabanshahoud2' },
        { type: 'facebook', value: 'https://www.facebook.com/share/1A8skHVGTf/' },
      ],
    },
    {
      name: 'يونس شحود',
      contacts: [
        { type: 'whatsapp', value: '963947468663' },
        { type: 'telegram', value: 'https://t.me/T_Younis_Shahoud' },
        { type: 'facebook', value: 'https://www.facebook.com/share/19ydC4c2pS/' },
      ],
    },
  ],

  // year: 1..4 ، department للسنة الرابعة فقط.
  subjects: [
    // السنة الثانية
    { name: 'المتتاليات والسلاسل التابعية', year: 2, teacher: 'يونس شحود' },
    { name: 'ميكانيك النقطة المادية', year: 2, teacher: 'يونس شحود' },
    { name: 'التوبولوجيا العامة 1', year: 2, teacher: 'شعبان شحود' },
    { name: 'الجبر الخطي 1', year: 2, teacher: 'شعبان شحود' },
    { name: 'المعادلات التفاضلية 1', year: 2, teacher: 'شعبان شحود' },
    // السنة الثالثة
    { name: 'التحليل العقدي 1', year: 3, teacher: 'يونس شحود' },
    { name: 'التحليل العددي', year: 3, teacher: 'يونس شحود' },
    { name: 'المعادلات الجزئية', year: 3, teacher: 'يونس شحود' },
    { name: 'نظرية المودولات', year: 3, teacher: 'شعبان شحود' },
    { name: 'نظرية الاحتمالات', year: 3, teacher: 'شعبان شحود' },
    { name: 'البرمجة بلغة C++', year: 3, teacher: 'شعبان شحود' },
    // السنة الرابعة – قسم التحليل
    { name: 'المعادلات التكاملية', year: 4, department: 'التحليل', teacher: 'يونس شحود' },
    { name: 'الهندسة التفاضلية', year: 4, department: 'التحليل', teacher: 'يونس شحود' },
    // السنة الرابعة – قسم التطبيقية
    { name: 'النمذجة الرياضية', year: 4, department: 'التطبيقية', teacher: 'شعبان شحود' },
    { name: 'ميكانيك المرونة', year: 4, department: 'التطبيقية', teacher: 'شعبان شحود' },
    { name: 'قواعد البيانات', year: 4, department: 'التطبيقية', teacher: 'شعبان شحود' },
    { name: 'البرمجة بلغة بايثون', year: 4, department: 'التطبيقية', teacher: 'شعبان شحود' },
  ],

  // المواعيد الأسبوعية الرسمية. المادة تُحدَّد باسمها وسنتها.
  lectures: [
    // السبت
    { day: 'saturday', start: '09:00', end: '11:00', subject: 'التحليل العقدي 1', year: 3 },
    { day: 'saturday', start: '11:00', end: '13:00', subject: 'المعادلات التكاملية', year: 4 },
    { day: 'saturday', start: '11:00', end: '12:30', subject: 'نظرية المودولات', year: 3 },
    { day: 'saturday', start: '12:30', end: '14:00', subject: 'البرمجة بلغة C++', year: 3 },
    { day: 'saturday', start: '13:00', end: '15:00', subject: 'الهندسة التفاضلية', year: 4 },
    { day: 'saturday', start: '14:00', end: '16:00', subject: 'النمذجة الرياضية', year: 4 },
    { day: 'saturday', start: '16:00', end: '18:00', subject: 'ميكانيك المرونة', year: 4 },
    // الأحد
    { day: 'sunday', start: '09:00', end: '11:00', subject: 'المعادلات التفاضلية 1', year: 2, group: 'A' },
    { day: 'sunday', start: '11:00', end: '13:00', subject: 'التوبولوجيا العامة 1', year: 2, group: 'A' },
    { day: 'sunday', start: '13:00', end: '15:00', subject: 'ميكانيك النقطة المادية', year: 2, group: 'B' },
    { day: 'sunday', start: '15:00', end: '16:30', subject: 'قواعد البيانات', year: 4 },
    { day: 'sunday', start: '16:30', end: '18:00', subject: 'البرمجة بلغة بايثون', year: 4 },
    { day: 'sunday', start: '16:30', end: '18:30', subject: 'التحليل العددي', year: 3 },
    // الإثنين
    { day: 'monday', start: '09:00', end: '11:00', subject: 'المتتاليات والسلاسل التابعية', year: 2, group: 'A' },
    { day: 'monday', start: '11:00', end: '13:00', subject: 'الجبر الخطي 1', year: 2, group: null },
    { day: 'monday', start: '13:00', end: '15:00', subject: 'المعادلات التفاضلية 1', year: 2, group: 'B' },
    { day: 'monday', start: '15:00', end: '17:00', subject: 'النمذجة الرياضية', year: 4 },
    // الثلاثاء
    { day: 'tuesday', start: '09:00', end: '11:00', subject: 'ميكانيك النقطة المادية', year: 2, group: 'A' },
    { day: 'tuesday', start: '16:30', end: '19:00', subject: 'البرمجة بلغة C++', year: 3 },
    // الأربعاء
    { day: 'wednesday', start: '14:30', end: '16:00', subject: 'النمذجة الرياضية', year: 4 },
    { day: 'wednesday', start: '16:00', end: '19:00', subject: 'البرمجة بلغة C++', year: 3 },
    // الخميس
    { day: 'thursday', start: '14:30', end: '16:30', subject: 'المتتاليات والسلاسل التابعية', year: 2, group: 'B' },
    { day: 'thursday', start: '16:30', end: '18:30', subject: 'التوبولوجيا العامة 1', year: 2, group: 'B' },
    // الجمعة
    { day: 'friday', start: '13:30', end: '15:30', subject: 'المعادلات الجزئية', year: 3 },
    { day: 'friday', start: '15:30', end: '17:00', subject: 'نظرية المودولات', year: 3 },
    { day: 'friday', start: '17:00', end: '18:30', subject: 'نظرية الاحتمالات', year: 3 },
  ],
};
