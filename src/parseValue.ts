import { Primitive } from "./Primitive";

export function parseValue(value: string): Primitive {
  // Convert to number if possible
  if (!isNaN(Number(value))) {
    return Number(value);
  }

  // Convert to boolean if the string is 'true' or 'false'
  if (value.toLowerCase() === 'true') {
    return true;
  } else if (value.toLowerCase() === 'false') {
    return false;
  }

  // Return as string if no conversion is possible
  return value;
}
