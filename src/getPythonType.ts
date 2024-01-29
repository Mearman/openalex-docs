import { Primitive } from "./Primitive";

export function getPythonType(value: Primitive) {
  let paramType;
  if (typeof value === "string") {
    paramType = "string";
  } else if (typeof value === "number") {
    if (Number.isInteger(value)) {
      paramType = "integer";
    } else {
      paramType = "number";
    }
  } else if (typeof value === "boolean") {
    paramType = "boolean";
  } else {
    paramType = "string";
  }

  if (paramType === "string") {
    value = `"${value}"`;
  }
  const output = `{type: "${paramType}"}`;
  return output;
}
