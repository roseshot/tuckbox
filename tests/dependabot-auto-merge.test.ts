import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const workflow = readFileSync(
  new URL("../.github/workflows/dependabot-auto-merge.yml", import.meta.url),
  "utf8",
);
const ci = readFileSync(
  new URL("../.github/workflows/ci.yml", import.meta.url),
  "utf8",
);

describe("Dependabot auto-merge workflow", () => {
  test("only runs following successful pull-request CI", () => {
    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain("workflows: [CI]");
    expect(workflow).toContain("types: [completed]");
    expect(workflow).toContain("github.event.workflow_run.event == 'pull_request'");
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).not.toContain("pull_request_target:");
  });

  test("checks Dependabot identity and the exact tested head commit", () => {
    expect(workflow).toContain('.user.login == "dependabot[bot]"');
    expect(workflow).toContain(".head.sha == $sha");
    expect(workflow).toContain('-f sha="$TESTED_SHA"');
    expect(workflow).toContain("-f merge_method=squash");
    expect(workflow).toContain("repos/$REPOSITORY/commits/$TESTED_SHA/pulls");
  });

  test("has no version, ecosystem, signature or commit-count eligibility filters", () => {
    expect(workflow).not.toMatch(/semver-(?:major|minor|patch)|update-type|dependency-name/);
    expect(workflow).not.toMatch(/commit\.verification|Signed-off-by|mergeable_state/);
    expect(workflow).not.toContain("scripts/dependabot-auto-merge.mjs");
  });

  test("does not check out or run untrusted PR code with a write token", () => {
    expect(workflow).toContain("pull-requests: write");
    expect(workflow).toContain("GH_TOKEN:");
    expect(workflow).not.toContain("actions/checkout");
    expect(ci).toContain("pull_request:");
    expect(ci).toContain("validate:");
    expect(ci).toContain("download-node:");
  });

  test("Dependabot still covers npm, Go, Docker, and GitHub Actions", () => {
    const config = readFileSync(
      new URL("../.github/dependabot.yml", import.meta.url), "utf8",
    );
    const ecosystems = [...config.matchAll(
      /^  - package-ecosystem: "([^"]+)"\n    directory: "([^"]+)"$/gm,
    )].map((match) => [match[1], match[2]]);
    expect(ecosystems).toEqual([
      ["npm", "/"],
      ["gomod", "/services/download-node"],
      ["docker", "/services/download-node"],
      ["github-actions", "/"],
    ]);
    expect(config).not.toMatch(/^\s*ignore:/m);
  });
});
