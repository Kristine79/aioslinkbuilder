/**
 * Outreach / messaging provider port.
 *
 * Sending outreach is strictly human-in-the-loop: a human approves the
 * prepared message and explicitly triggers `send`. The provider is only
 * invoked from that approved action — never automatically.
 */
export interface OutreachSendResult {
  externalId: string;
  sentAt: string;
}

export interface OutreachProvider {
  readonly name: string;
  send(input: {
    to: string;
    subject: string;
    body: string;
  }): Promise<OutreachSendResult>;
}
