const BUS: any = null;
const COMMAND = {
  "/test/topic": (data) => {},
  "-/test/async/topic": (data) => {},
};
const COMMAND_ARRAY = {
  "/array/test/topic": (data) => {},
  "-/array/test/async/topic": (data) => {},
};

export function registerHooks() {
  registerReturnNull(COMMAND);
  registerReturnArray(COMMAND_ARRAY);
}
/**
 * 处理返回数据 | null 的函数
 * @param command { 事件主题 : 事件注册函数}
 */
function registerReturnNull(command: typeof COMMAND) {
  for (const key of Object.keys(command)) {
    if (key.startsWith("-")) {
      BUS.rpcService(key.substring(1), (args) => {
        try {
          const ret = invokeAsArgumentArray(command[key])(args);
          if (ret instanceof Promise) {
            return ret.catch((ex) => Promise.reject(ex));
          } else {
            return ret || null;
          }
        } catch (ex) {
          return Promise.reject(ex);
        }
      });
    } else {
      BUS.subscribe(key, invokeAsArgumentArray(command[key]));
    }
  }
}
/**
 * 处理返回数据 | [] 的函数
 * @param command { 事件主题 : 事件注册函数}
 */
function registerReturnArray(command: typeof COMMAND_ARRAY) {
  for (const key of Object.keys(command)) {
    if (key.startsWith("-")) {
      BUS.rpcService(key.substring(1), (args) => {
        try {
          const ret = invokeAsArgumentArray(command[key])(args);
          if (ret instanceof Promise) {
            return ret
              .then(
                (re) => re || [],
                (ex) => Promise.reject(ex)
              )
              .catch((ex) => Promise.reject(ex));
          } else {
            return ret || [];
          }
        } catch (ex) {
          return Promise.reject(ex);
        }
      });
    } else {
      BUS.subscribe(key, invokeAsArgumentArray(command[key]));
    }
  }
}

function invokeAsArgumentArray(func: Function) {
  return (message) =>
    func.apply(func, Array.isArray(message) ? message : [message]);
}
