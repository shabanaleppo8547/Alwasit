import { ActionForm, Field, SubmitButton } from './forms';
import { approveDeviceRequestAction, rejectDeviceRequestAction } from '@/server/actions/admin-devices';

/** أزرار الموافقة/الرفض لطلب نقل جهاز. */
export function DeviceRequestActions({ id, studentName }: { id: string; studentName: string }) {
  return (
    <div className="flex flex-col gap-2">
      <ActionForm action={approveDeviceRequestAction} confirm={`اعتماد الجهاز الجديد لـ ${studentName}؟ سيُلغى الجهاز القديم وتُغلق كل جلساته.`}>
        <input type="hidden" name="id" value={id} />
        <SubmitButton className="btn-primary btn-sm w-full">موافقة واعتماد الجهاز الجديد</SubmitButton>
      </ActionForm>
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-danger">رفض</summary>
        <ActionForm action={rejectDeviceRequestAction} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="id" value={id} />
          <Field name="note" label="سبب الرفض (اختياري)" id={id} />
          <SubmitButton className="btn-danger btn-sm">تأكيد الرفض</SubmitButton>
        </ActionForm>
      </details>
    </div>
  );
}

