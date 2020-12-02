type Impossible<K extends keyof any> = {
  [P in K]: never;
};

export type NoExtraProperties<T, U extends T = T> = U extends Array<infer V>
  ? NoExtraProperties<V>[]
  : U & Impossible<Exclude<keyof U, keyof T>>;
