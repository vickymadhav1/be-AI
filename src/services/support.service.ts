import type { SupportRequestDto } from '../validators/support.validator';

export const submitSupportRequest = async (userId: string, report: SupportRequestDto) => {
  const ticketId = `support_${Date.now()}`;

  console.info('[Support] Request received', {
    ticketId,
    userId,
    type: report.type,
  });

  return {
    ticketId,
    submittedAt: new Date().toISOString(),
  };
};
