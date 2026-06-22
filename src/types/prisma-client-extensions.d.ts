declare module '@prisma/client' {
  export enum ReportStatus {
    OPEN = 'OPEN',
    RESOLVED = 'RESOLVED',
  }

  export enum ReportTargetType {
    PASS = 'PASS',
    CREATOR = 'CREATOR',
  }
}
