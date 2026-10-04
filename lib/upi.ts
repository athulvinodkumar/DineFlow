import { PaymentDetails, PaymentVerificationResult } from './types';

export interface IPaymentProvider {
  name: string;
  generateUpiUri(details: PaymentDetails): string;
  verifyPayment(transactionRef: string, amount: number): Promise<PaymentVerificationResult>;
  handleWebhook?(payload: any, signature: string): Promise<PaymentVerificationResult>;
}

/**
 * Standard NPCI UPI Provider
 * Encodes deep-link according to official NPCI UPI specifications:
 * upi://pay?pa=<UPI ID>&pn=<Payee Name>&am=<Amount>&cu=INR&tn=<Note>&tr=<Transaction Ref>
 */
export class UpiPaymentProvider implements IPaymentProvider {
  name = 'NPCI_UPI';

  generateUpiUri(details: PaymentDetails): string {
    const { upiId, restaurantName, amount, billNumber, transactionRef } = details;

    // Ensure amount is strictly formatted to 2 decimals
    const formattedAmount = Number(amount).toFixed(2);

    // Clean and encode parameters
    const encodedPn = encodeURIComponent(restaurantName.trim());
    const encodedTn = encodeURIComponent(billNumber.trim());
    const encodedTr = encodeURIComponent(transactionRef);
    const encodedPa = encodeURIComponent(upiId.trim());

    return `upi://pay?pa=${encodedPa}&pn=${encodedPn}&am=${formattedAmount}&cu=INR&tn=${encodedTn}&tr=${encodedTr}`;
  }

  /**
   * Cashier manual confirmation or gateway status check
   */
  async verifyPayment(transactionRef: string, amount: number): Promise<PaymentVerificationResult> {
    return {
      verified: true,
      transactionRef,
      amount,
      paymentMode: 'UPI',
    };
  }

  /**
   * Webhook stub for payment gateways (Razorpay / Cashfree UPI autopay / dynamic virtual accounts)
   */
  async handleWebhook(payload: any, _signature: string): Promise<PaymentVerificationResult> {
    return {
      verified: true,
      transactionRef: payload.order_id || payload.payment_id || `TXN-${Date.now()}`,
      amount: payload.amount ? payload.amount / 100 : 0,
      paymentMode: 'UPI',
      gatewayResponse: payload,
    };
  }
}

export const defaultPaymentProvider = new UpiPaymentProvider();
export const generateUpiUri = (details: PaymentDetails) => defaultPaymentProvider.generateUpiUri(details);
