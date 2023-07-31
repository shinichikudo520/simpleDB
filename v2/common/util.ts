export function forEach<T>(
  data: Array<T>,
  cb: (key: undefined, value: T, index: number) => any
);
export function forEach<T>(
  data: { [key: number]: T },
  cb: (key: string, value: T, index: number) => any
);
export function forEach<T>(
  data: { [key: string]: T },
  cb: (key: string, value: T, index: number) => any
);
export function forEach<T>(data: any, cb: any);
export function forEach<T>(data: any, cb: any) {
  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      if (cb(undefined, data[i], i) === false) return;
    }
  } else {
    let i = 0;
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key];
        if (cb(key, value, i) === false) return;
        i++;
      }
    }
  }
}

export async function forEachA<T>(
  data: Array<T>,
  cb: (key: undefined, value: T, index: number) => Promise<any>
);
export async function forEachA<T>(
  data: { [key: number]: T },
  cb: (key: string, value: T, index: number) => Promise<any>
);
export async function forEachA<T>(
  data: { [key: string]: T },
  cb: (key: string, value: T, index: number) => Promise<any>
);
export async function forEachA<T>(data: any, cb: any);
export async function forEachA<T>(data: any, cb: any) {
  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      if ((await cb(undefined, data[i], i)) === false) return;
    }
  } else {
    let i = 0;
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key];
        if ((await cb(key, value, i)) === false) return;
        i++;
      }
    }
  }
}
