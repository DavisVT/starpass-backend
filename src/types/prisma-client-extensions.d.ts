declare module '@prisma/client' {
  export enum ReportStatus {
    PENDING = 'PENDING',
    OPEN = 'OPEN',
    RESOLVED = 'RESOLVED',
    DISMISSED = 'DISMISSED',
  }

  export enum ReportTargetType {
    PASS = 'PASS',
    CREATOR = 'CREATOR',
    TIER = 'TIER',
  }
}
