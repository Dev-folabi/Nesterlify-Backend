export interface GatePayOrderPayload {
  orderId: string;
  amount: number;
  currency: string;
  returnUrl: string;
  cancelUrl: string;
  webhookUrl: string;
}

export interface PaymentStatusRequest {
  orderId: string;
}
