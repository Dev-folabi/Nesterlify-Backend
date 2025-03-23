import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const { NOW_PAYMENT_BASE_URL, NOW_PAYMENT_API_KEY } = process.env;

const API_KEY = NOW_PAYMENT_API_KEY;
const BASE_URL = NOW_PAYMENT_BASE_URL;

interface CurrencyResponse {
  currencies: string[];
}

interface PaymentRequest {
  price_amount: number;
  price_currency: string;
  pay_currency: string;
  ipn_callback_url?: string;
  order_id?: string;
  order_description?: string;
}

interface PaymentResponse {
  payment_id: string;
  payment_status: string;
  pay_address: string;
  pay_amount: number;
  price_currency: string;
  pay_currency: string;
}

class NowPaymentsService {
  async getAvailableCurrencies(): Promise<CurrencyResponse | null> {
    try {
      const response = await axios.get<CurrencyResponse>(
        `${BASE_URL}/full-currencies`,
        {
          headers: { "x-api-key": API_KEY },
        }
      );
      return response.data;
    } catch (error: any) {
      console.error(
        "Error fetching currencies:",
        error.response?.data || error.message
      );
      return error.response?.data?.message;
    }
  }

  async createPayment(
    paymentData: PaymentRequest
  ): Promise<PaymentResponse | null> {
    try {
      const response = await axios.post<PaymentResponse>(
        `${BASE_URL}/payment`,
        paymentData,
        {
          headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
        }
      );
      return response.data;
    } catch (error: any) {
      console.error(
        "Error fetching currencies:",
        error.response?.data || error.message
      );
      return error.response?.data?.message;
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentResponse | null> {
    try {
      const response = await axios.get<PaymentResponse>(
        `${BASE_URL}/payment/${paymentId}`,
        {
          headers: { "x-api-key": API_KEY },
        }
      );
      return response.data;
    } catch (error: any) {
      console.error(
        "Error fetching currencies:",
        error.response?.data || error.message
      );
      return error.response?.data?.message;
    }
  }
}

export default new NowPaymentsService();
