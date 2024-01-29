export function convertUrlToApiCallCodeFence(url: string) {
  const typedUrl = new URL(url);
  const pathname = typedUrl.pathname;
  const entity = pathname.split("/")[1];
  const id: string | undefined = pathname.split("/")[2];
  const searchParams: URLSearchParams = typedUrl.searchParams;
  const searchParamsArray: { key: string; value: string; }[] = Array.from(searchParams).map(([key, value]) => ({ key, value }));

  const params: { key: string, value: Primitive; }[] = searchParamsArray.map(
    (param) => {
      // if value is parsed as a number, return a number
      let value: Primitive = parseValue(param.value);
      return ({
        key: param.key.replace("-", "_"),
        value: value
      });
    }
  );

  const apiInstance = `${entity}_api`;

  // drop the s from the call if there is an id
  // let call = id ? `get_${entity.slice(0, -1)}` : `get_${entity}`;
  let call: string;
  let singularCall = false;
  if (entity === "autocomplete") {
    call = `get_${entity}_${id}`;
  } else {
    call = id ? `get_${entity.slice(0, -1)}` : `get_${entity}`;
    if (id) {
      params.push({ key: "id", value: id });
      singularCall = true;
    }
  }


  // add the id to the call args if it exists
  const codeFence = [
    "```python",
    `# @title { run: "auto", vertical-output: false }`,
    // original url as comment
    `# ${url}`,
    `${params
      // group_by = 0 # @param {type:"integer"}
      .map(({ key, value }) => `${key}=${wrapIfString(value)} # @param ${getPythonType(key, value)}`)
      .join(",\n")}`,
    "",
    `response = ${apiInstance}.${call}(`,
    // `\t${params
    //   .map(({ key, value }) => `${key}="${value}"`)
    //   .join(",\n\t")}`,
    // ")",
    `\t${params
      .map(({ key, value }) => `${key}=${key}`)
      .join(",\n\t")}`,
    ")",
    "",
    ...(
      singularCall ? [
        // "# transpose the single result into a dataframe",
        `df = pd.DataFrame(response).T.rename(columns=lambda x: x[0]).drop(0).set_index('id')`,
      ] : [
        `df = pd.DataFrame(response.results)`,
      ]),
    `display(df)`,
    "```",
    // "print(json.dumps(response.to_dict(), indent=2))",
    // if there is a results object that is the primary df, if not use the response
    ...(
      singularCall ? [] : [
        "```python",
        `numeric_df = df[['id', 'display_name'] +`,
        `\t[col for col in df.columns if df[col].dtype in ['int64', 'float64'] and col != 'relevance_score']]`,
        `display(numeric_df)`,
        ``,
        `try:`,
        `\tllm = OpenAI(api_token = openapi_token)`,
        `\tsdf = SmartDataframe(numeric_df, config = { "llm": llm })`,
        `\tsdf.chat("Plot a chart of this data")`,
        `except:`,
        `\tif not openapi_token:`,
        `\t\tprint("Error: openapi_token not set")`,
        `\telse:`,
        `\t\tprint("Error when creating SmartDataframe")`,
        "```",
      ])
  ].join("\n");
  console.log(codeFence);
  return codeFence;
}
function getPythonType(key, value: Primitive) {
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
  const output = `${value} {type: "${paramType}"}`;
  return output;
}

function parseValue(value: string): Primitive {
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

type Primitive = string | number | boolean;

function wrapIfString(value: Primitive): Primitive {
  if (typeof value === "string") {
    return `"${value.replace(/"/g, '\\"')}"`;
  } else {
    return value;
  }
}

