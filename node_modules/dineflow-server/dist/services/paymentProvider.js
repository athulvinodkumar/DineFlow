"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultPaymentProvider = exports.UpiPaymentProvider = void 0;
/**
 * Standard NPCI UPI Provider
 * Encodes deep-link according to official NPCI UPI specifications:
 * upi://pay?pa=<UPI ID>&pn=<Payee Name>&am=<Amount>&cu=INR&tn=<Note>&tr=<Transaction Ref>
 */
class UpiPaymentProvider {
    name = 'NPCI_UPI';
    generateUpiUri(details) {
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
    async verifyPayment(transactionRef, amount) {
        // In direct UPI QR mode, confirmation is authenticated by cashier or direct bank notification
        return {
            verified: true,
            transactionRef,
            amount,
            paymentMode: 'UPI',
        };
    }
    /**
     * Webhook stub for plugging in Razorpay / Cashfree UPI autopay / dynamic dynamic virtual accounts
     */
    async handleWebhook(payload, signature) {
        // Future expansion: Razorpay / Cashfree signature validation
        return {
            verified: true,
            transactionRef: payload.order_id || payload.payment_id || `TXN-${Date.now()}`,
            amount: payload.amount ? payload.amount / 100 : 0,
            paymentMode: 'UPI',
            gatewayResponse: payload,
        };
    }
}
exports.UpiPaymentProvider = UpiPaymentProvider;
exports.defaultPaymentProvider = new UpiPaymentProvider();
