export type KEY_PROP_NAME = "uuid" | "path" | "hash" | "projectId";
export type KEY_TYPE = string | number | Array<string | number>;

export type update<T> = (data: T) => T;

export type callback<T> = (data: T) => T | null;
