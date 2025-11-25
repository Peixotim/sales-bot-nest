export interface BoomError extends Error {
  output?: {
    statusCode: number;
    payload?: any;
  };
  data?: any;
}
