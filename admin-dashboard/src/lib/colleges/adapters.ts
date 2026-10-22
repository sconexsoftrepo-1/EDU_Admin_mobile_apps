/** Synchronous demo boundaries. Production adapters belong on authenticated servers. */
export interface PaymentProvider {
  confirm(input: { amount: number; reference: string; outcome: string }): {
    reference: string;
    status: "Completed";
  };
}
export class MockPaymentProvider implements PaymentProvider {
  confirm(input: { amount: number; reference: string; outcome: string }) {
    if (input.outcome === "Failure")
      throw Error("Simulated payment declined. No money or records changed.");
    if (input.amount <= 0 || !Number.isSafeInteger(input.amount))
      throw Error("Invalid payment amount.");
    return { reference: input.reference, status: "Completed" as const };
  }
}
export interface SMSProvider {
  send(input: { subject: string; message: string; scheduled: boolean }): {
    status: "Simulated" | "Scheduled";
    message: string;
  };
}
export class MockSMSProvider implements SMSProvider {
  send(input: { subject: string; message: string; scheduled: boolean }) {
    if (!input.subject || !input.message)
      throw Error("Enter subject and message.");
    return {
      status: input.scheduled ? ("Scheduled" as const) : ("Simulated" as const),
      message: input.message,
    };
  }
}
