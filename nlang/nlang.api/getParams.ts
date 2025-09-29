/**
 * Infers params from a route with a requested path, returning an object with all variables
 * such as [a] [b] [c], filled with the values found in the path
 *
 * @example
 * getParams('/users/[id]', '/users/123') // returns { id: '123' }
 * getParams('/posts/[year]/[month]', '/posts/2024/03') // returns { year: '2024', month: '03' }
 */
export const getParams = (route: string, path: string) => {
  const params: { [param: string]: string } = {};

  // Handle empty or invalid inputs
  if (!route || !path) {
    return params;
  }

  // Split both strings into segments
  const routeParts = route.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);

  // If the parts don't match in length, return empty params
  if (routeParts.length !== pathParts.length) {
    return params;
  }

  // Iterate through the route parts to find parameters
  for (let i = 0; i < routeParts.length; i++) {
    const routePart = routeParts[i];
    const pathPart = pathParts[i];

    // Check if this part is a parameter (enclosed in square brackets)
    if (routePart.startsWith("[") && routePart.endsWith("]")) {
      // Extract the parameter name (remove the brackets)
      const paramName = routePart.slice(1, -1);
      params[paramName] = pathPart;
    } else if (routePart !== pathPart) {
      // If this is not a parameter and parts don't match, return empty params
      return {};
    }
  }

  return params;
};
