export interface IConnectionOptions {
  dsn: string;
  exchange: string;
  exchangeType: 'topic';
  connectionName: string;
  maxConnectionAttempts?: number;
  processExitWhenUnableToConnectFirstTime?: boolean
}
