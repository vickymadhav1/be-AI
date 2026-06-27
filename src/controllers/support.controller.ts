import type { Request, Response } from 'express';
import { submitSupportRequest as submitSupportRequestService } from '../services/support.service';
import { sendSuccess } from '../utils/api-response';
import type { SupportRequestDto } from '../validators/support.validator';

export const submitRequest = async (
  request: Request,
  response: Response,
): Promise<void> => {
  sendSuccess(
    response,
    201,
    await submitSupportRequestService(request.user!.id, request.body as SupportRequestDto),
    'Support request submitted',
  );
};
