export interface IConnectionOptions {
  dsn: string;
  exchange: string;
  exchangeType: 'topic';
  connectionName: string;
  numberOfConnectionAttempts?: number;
  processExitWhenUnableToConnectFirstTime?: boolean
}
