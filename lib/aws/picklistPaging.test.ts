import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/aws/appsyncGraphql", () => ({
  executeAppSyncGraphql: vi.fn(),
}));

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import {
  fetchAllPicklistPages,
  fetchCitiesInState,
  fetchWorkplacesByName,
} from "./appsyncPicklistQueries";

const exec = vi.mocked(executeAppSyncGraphql);

const rows = (n: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => ({ value: `${prefix}${i}`, label: `${prefix}${i}` }));

/**
 * Acceptance check for `city-workplace-search-paging`, WORKLIST Phase 0.
 *
 * `limit: 100` with no token meant a common prefix returned whichever hundred
 * OpenSearch felt like, and a city outside that slice could not be picked at all.
 */
describe("fetchAllPicklistPages", () => {
  beforeEach(() => exec.mockReset());

  it("follows nextToken to exhaustion and concatenates", async () => {
    exec
      .mockResolvedValueOnce({
        data: { searchCities: { items: rows(100, "a"), nextToken: "t1" } },
      } as never)
      .mockResolvedValueOnce({
        data: { searchCities: { items: rows(7, "b"), nextToken: null } },
      } as never);

    const result = await fetchAllPicklistPages("searchCities", (token) =>
      token ? `Q(${token})` : "Q()",
    );

    expect(result).toHaveLength(107);
    expect(exec).toHaveBeenCalledTimes(2);
    // The token has to reach the second request, or paging is a no-op loop.
    expect((exec.mock.calls[1]![0] as { query: string }).query).toBe("Q(t1)");
  });

  /** A row with no id cannot be selected; letting it through saves nothing. */
  it("drops rows without a value", async () => {
    exec.mockResolvedValueOnce({
      data: {
        searchCities: {
          items: [{ value: "", label: "blank" }, null, { value: "c1", label: "ok" }],
          nextToken: null,
        },
      },
    } as never);

    const result = await fetchAllPicklistPages("searchCities", () => "Q");
    expect(result).toEqual([{ value: "c1", label: "ok" }]);
  });

  it("stops at the page cap even if the resolver keeps returning a token", async () => {
    exec.mockResolvedValue({
      data: { searchCities: { items: rows(100, "x"), nextToken: "always" } },
    } as never);

    const result = await fetchAllPicklistPages("searchCities", () => "Q");
    expect(exec.mock.calls.length).toBeLessThanOrEqual(20);
    expect(result.length).toBeLessThanOrEqual(2000);
  });

  it("returns an empty list when the field is missing", async () => {
    exec.mockResolvedValueOnce({ data: {} } as never);
    await expect(fetchAllPicklistPages("searchCities", () => "Q")).resolves.toEqual(
      [],
    );
  });
});

describe("the two typeaheads page", () => {
  beforeEach(() => exec.mockReset());

  it("pages cities and selects nextToken in the document", async () => {
    exec
      .mockResolvedValueOnce({
        data: { searchCities: { items: rows(100, "c"), nextToken: "t1" } },
      } as never)
      .mockResolvedValueOnce({
        data: { searchCities: { items: rows(7, "d"), nextToken: null } },
      } as never);

    const result = await fetchCitiesInState("NY", "Zur");
    expect(result).toHaveLength(107);

    const first = (exec.mock.calls[0]![0] as { query: string }).query;
    expect(first).toMatch(/nextToken/);
    expect(first).toContain("Zur");
    // Page two must carry the token as an argument, not just select the field.
    expect((exec.mock.calls[1]![0] as { query: string }).query).toMatch(
      /nextToken:\s*"t1"/,
    );
  });

  it("pages workplaces", async () => {
    exec
      .mockResolvedValueOnce({
        data: { searchWorkplaces: { items: rows(100, "w"), nextToken: "t1" } },
      } as never)
      .mockResolvedValueOnce({
        data: { searchWorkplaces: { items: rows(3, "v"), nextToken: null } },
      } as never);

    await expect(fetchWorkplacesByName("Gen")).resolves.toHaveLength(103);
  });

  it("does not query on an empty term", async () => {
    await expect(fetchCitiesInState("NY", "  ")).resolves.toEqual([]);
    await expect(fetchWorkplacesByName("")).resolves.toEqual([]);
    expect(exec).not.toHaveBeenCalled();
  });
});
