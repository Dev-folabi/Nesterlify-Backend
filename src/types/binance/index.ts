export interface BinanceOrderPayload {
  env: { terminalType: string };
  merchantTradeNo: string;
  orderAmount: number;
  currency: string;
  goods: {
    goodsType: string;
    goodsCategory: string;
    referenceGoodsId: string;
    goodsName: string;
    goodsDetail: string;
  };
  tradeType: string;
  timeout: number;
  returnUrl: string;
  cancelUrl: string;
  webhookUrl: string;
}

export interface PaymentStatusRequest {
  orderId: string;
}
