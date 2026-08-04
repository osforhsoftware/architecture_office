export function paymentDeleteConfirmationPhrase(paymentId: number): string {
  return `delete_payment_${paymentId}`
}

export function invoicePaymentDeleteConfirmationPhrase(paymentId: number): string {
  return `delete_invoice_payment_${paymentId}`
}
