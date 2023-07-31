export default class Check {
  static notNull<T>(v: T | number): T | number {
    if (v || v === 0) {
      return v;
    } else {
      throw new Error(`invalid null value! ${v}`);
    }
  }

  static mustString(v: string) {
    if (typeof v === "string") {
      return v;
    } else {
      throw new Error(`value must be string! ${v}`);
    }
  }
  static mustNumber(v: number) {
    if (typeof v === "number" && isFinite(v)) {
      return v;
    } else {
      throw new Error(`value must be number! ${v}`);
    }
  }

  static mustDate(v: Date) {
    if (v instanceof Date) {
      return v;
    } else {
      throw new Error(`value must be Date! ${v}`);
    }
  }

  static mustNull(v: null): null {
    if (v === null) {
      return v;
    } else {
      throw new Error(`value must be null! ${v}`);
    }
  }

  static mustUndefined(v: undefined): undefined {
    if (v === undefined) {
      return v;
    } else {
      throw new Error(`value must be undefined! ${v}`);
    }
  }

  static mustArray<T>(v: Array<T>): Array<T> {
    if (Array.isArray(v)) {
      return v;
    } else {
      throw new Error(`value must be Array! ${v}`);
    }
  }

  static mustBool(v: boolean): boolean {
    if (v === false || v === true) {
      return v;
    } else {
      throw new Error(`value must be Boolean! ${v}`);
    }
  }
}
