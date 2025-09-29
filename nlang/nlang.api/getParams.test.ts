import { getParams } from "./getParams";

// Tests
const tests = [
  {
    route: "/users/[id]",
    path: "/users/123",
    expected: { id: "123" },
  },
  {
    route: "/posts/[year]/[month]",
    path: "/posts/2024/03",
    expected: { year: "2024", month: "03" },
  },
  {
    route: "/api/[version]/[resource]/[id]",
    path: "/api/v1/users/abc-123",
    expected: { version: "v1", resource: "users", id: "abc-123" },
  },
  {
    route: "/static/page",
    path: "/static/page",
    expected: {},
  },
  {
    route: "/products/[category]/[id]/[variant]",
    path: "/products/electronics/tv-123/black",
    expected: { category: "electronics", id: "tv-123", variant: "black" },
  },
  // Edge cases
  {
    route: "",
    path: "",
    expected: {},
  },
  {
    route: "/users/[id]",
    path: "/users/123/extra",
    expected: {},
  },
  {
    route: "/users/profile",
    path: "/users/settings",
    expected: {},
  },
];

// Run tests
tests.forEach((test, index) => {
  const result = getParams(test.route, test.path);
  const passed = JSON.stringify(result) === JSON.stringify(test.expected);
  console.log(`Test ${index + 1}: ${passed ? "PASSED" : "FAILED"}`);
  if (!passed) {
    console.log("Expected:", test.expected);
    console.log("Got:", result);
  }
});
