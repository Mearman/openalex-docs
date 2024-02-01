import { Primitive } from "./Primitive";

export function wrapIfString(value: Primitive): Primitive {
  if (typeof value === "string") {
    return `"${value.replace(/"/g, '\\"')}"`;
  } else {
    return value;
  }
}
