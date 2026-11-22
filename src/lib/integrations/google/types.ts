export type GoogleConnectionPublic = {
  configured: boolean;
  connected: boolean;
  googleAccountEmail: string | null;
  calendarId: string;
  calendarSummary: string | null;
  pushEnabled: boolean;
  lastSyncedAt: string | null;
};
