// Fehlertext der Functions, wenn der Aufrufer kein Mitglied der Gruppe ist
// (requireMember in index.ts). Das Frontend erkennt daran den Zugangsverlust
// und schickt zum Login – ein permission-denied wegen falschen Passworts
// bleibt dagegen ein normaler Fehler im Dialog.
export const NOT_MEMBER_MESSAGE = "Not a member";
