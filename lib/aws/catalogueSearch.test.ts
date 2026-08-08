import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/aws/appsyncGraphql", () => ({
  executeAppSyncGraphql: vi.fn(),
}));

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import {
  fetchDiagnoses,
  fetchHospitals,
  searchDiagnoses,
  searchHospitals,
} from "./appsyncPicklistQueries";

const exec = vi.mocked(executeAppSyncGraphql);
const q = (call: number) => (exec.mock.calls[call]![0] as { query: string }).query;

/** Acceptance check for `catalogue-search-server-side`, WORKLIST Phase 0. */
describe("catalogue search is server-side", () => {
  beforeEach(() => exec.mockReset());

  /**
   * The worklist named this resolver `findDiagnoses`. It is `findDiagnosis`,
   * singular — confirmed against the live schema. The plural name does not exist,
   * so the wrong one would have failed every query.
   */
  it("calls findHospitals and findDiagnosis with (name, from, size)", async () => {
    exec.mockResolvedValue({ data: { findHospitals: { items: [] } } } as never);
    await searchHospitals("Zur");
    expect(q(0)).toMatch(/findHospitals\(name:\s*"Zur",\s*from:\s*0,\s*size:\s*100\)/);

    exec.mockReset();
    exec.mockResolvedValue({ data: { findDiagnosis: { items: [] } } } as never);
    await searchDiagnoses("Leuk");
    expect(q(0)).toMatch(/findDiagnosis\(name:\s*"Leuk",\s*from:\s*0,\s*size:\s*100\)/);
  });

  /**
   * The integration case from the worklist: the only "Zur" match sits well past
   * any client-side slice. Server-side search finds it; the old
   * `listHospitals(limit: 1000)` + local filter could not.
   */
  it("returns a match the old preloaded slice would have missed", async () => {
    exec.mockResolvedValue({
      data: { findHospitals: { items: [{ value: "h1150", label: "Zurich General" }] } },
    } as never);

    await expect(searchHospitals("Zur")).resolves.toEqual([
      { value: "h1150", label: "Zurich General" },
    ]);
    // One request carrying the term — not a full-catalogue fetch.
    expect(exec).toHaveBeenCalledTimes(1);
    expect(q(0)).toContain("Zur");
  });

  it("does not query on a blank term", async () => {
    await expect(searchHospitals("   ")).resolves.toEqual([]);
    await expect(searchDiagnoses("")).resolves.toEqual([]);
    expect(exec).not.toHaveBeenCalled();
  });

  it("drops rows without an id and survives a failure", async () => {
    exec.mockResolvedValueOnce({
      data: { findHospitals: { items: [{ value: "", label: "x" }, null] } },
    } as never);
    await expect(searchHospitals("abc")).resolves.toEqual([]);

    exec.mockRejectedValueOnce(new Error("network"));
    await expect(searchDiagnoses("abc")).resolves.toEqual([]);
  });
});

describe("the full catalogues page instead of capping at 1000", () => {
  beforeEach(() => exec.mockReset());

  it("follows nextToken for hospitals and diagnoses", async () => {
    exec
      .mockResolvedValueOnce({
        data: { listHospitals: { items: [{ value: "a", label: "A" }], nextToken: "t1" } },
      } as never)
      .mockResolvedValueOnce({
        data: { listHospitals: { items: [{ value: "b", label: "B" }], nextToken: null } },
      } as never);
    await expect(fetchHospitals()).resolves.toHaveLength(2);
    expect(q(1)).toMatch(/nextToken:\s*"t1"/);

    exec.mockReset();
    exec.mockResolvedValueOnce({
      data: { listDiagnoses: { items: [{ value: "d", label: "D" }], nextToken: null } },
    } as never);
    await expect(fetchDiagnoses()).resolves.toHaveLength(1);
  });

  /**
   * The literal the worklist requires gone. Comments are stripped first: the
   * docblocks explaining the old cap quote it verbatim, and a naive grep over the
   * whole file matches its own explanation.
   */
  it("leaves no limit-1000 cap on either large catalogue", () => {
    const code = readFileSync("lib/aws/appsyncPicklistQueries.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/listHospitals\(limit:\s*1000\)/);
    expect(code).not.toMatch(/listDiagnoses\(limit:\s*1000\)/);
    // And the replacements really are parameterised.
    expect(code).toMatch(/listHospitals\(limit:\s*\$\{PICKLIST_PAGE_SIZE\}/);
    expect(code).toMatch(/listDiagnoses\(limit:\s*\$\{PICKLIST_PAGE_SIZE\}/);
  });
});
