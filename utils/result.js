import dayjs from "dayjs";
export class Result {
  constructor(code, message, data = {}) {
    this.code = code;
    this.message = message + ", " + dayjs().format("YYYY-MM-DD HH:mm:ss");
    this.data = data;
  }
  static success(message, data = {}) {
    return new Result(0, message, data);
  }
  static error(message) {
    return new Result(1, message, {});
  }
}
