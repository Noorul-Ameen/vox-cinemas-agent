const normalizeDecisionText = (value) => String(value || "")
  .normalize("NFKC")
  .toLowerCase()
  .replace(/[’']/g, "")
  .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu, "")
  .replace(/[.!?,;:،؟]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

export function resolveCancellationDecision(value) {
  const text = normalizeDecisionText(value);
  if (!text) return null;

  if (/^(?:no|no thanks|no thank you|not now|stop|back|keep it|keep the booking|keep my booking|do not cancel(?: it| this| the booking| my booking)?|dont cancel(?: it| this| the booking| my booking)?|لا|لأ|ليس الآن|تراجع|احتفظ بالحجز|لا (?:تلغ|تلغي)(?: الحجز|ه)?)$/u.test(text)) return false;

  if (/^(?:yes|yes please|yeah|yep|sure|okay|ok|confirm|confirmed|proceed|go ahead|do it|cancel it|yes cancel it|yes please cancel it|please cancel it|go ahead and cancel it|confirm cancellation|confirm the cancellation|proceed with cancellation|proceed with the cancellation)(?: now| please)?$/u.test(text)) return true;
  if (/^(?:yes|yeah|yep|sure|okay|ok)(?: please)? (?:go ahead(?: and)? )?(?:cancel|confirm|proceed)(?: with)?(?: it| this| the booking| my booking| this booking| the cancellation)?(?: now| please)?$/u.test(text)) return true;
  if (/^(?:نعم|ايوه|أيوه|أكيد|اكد|أكد|تأكيد|تابع|نفذ)(?: من فضلك)?(?: (?:الغ|ألغ)(?: الحجز|ه|يه|ي الحجز)?| أكد الإلغاء| تابع الإلغاء)?(?: من فضلك)?$/u.test(text)) return true;

  return null;
}
