export function testCaseRoute(canonicalId: string) {
  return { name: "test-case", params: { id: canonicalId } };
}

export function executionRoute(id: string) {
  return { name: "execution", params: { id } };
}

export function requirementRoute(id: string) {
  return { path: "/requirements", hash: `#requirement-${encodeURIComponent(id)}` };
}

export function evidenceRoute() {
  return { path: "/downloads", hash: "#evidence-artifacts" };
}
