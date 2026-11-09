import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEVELOPMENT_API_BASE_URL,
  injectApiBaseUrl,
  resolveApiBaseUrl
} from "../scripts/deployment-config.mjs";

test("preview builds default to the Neon Development API", () => {
  assert.equal(resolveApiBaseUrl({ deploymentTarget: "preview" }), DEVELOPMENT_API_BASE_URL);
});

test("production builds require a separate API endpoint", () => {
  assert.throws(
    () => resolveApiBaseUrl({ deploymentTarget: "production" }),
    /require ERP_API_BASE_URL/
  );
  assert.throws(
    () => resolveApiBaseUrl({
      deploymentTarget: "production",
      apiBaseUrl: DEVELOPMENT_API_BASE_URL
    }),
    /cannot use the Neon Development API/
  );
});

test("production endpoint normalizes trailing slashes and requires HTTPS", () => {
  assert.equal(
    resolveApiBaseUrl({
      deploymentTarget: "production",
      apiBaseUrl: "https://erp-api.example.com///"
    }),
    "https://erp-api.example.com"
  );
  assert.throws(
    () => resolveApiBaseUrl({
      deploymentTarget: "production",
      apiBaseUrl: "http://erp-api.example.com"
    }),
    /must use HTTPS/
  );
});

test("build replaces the configured API meta value and fails without the marker", () => {
  const source = '<meta name="jb-api-base-url" content="">';
  assert.equal(
    injectApiBaseUrl(source, DEVELOPMENT_API_BASE_URL),
    '<meta name="jb-api-base-url" content="' + DEVELOPMENT_API_BASE_URL + '">'
  );
  assert.throws(
    () => injectApiBaseUrl("<html></html>", DEVELOPMENT_API_BASE_URL),
    /missing the jb-api-base-url meta tag/
  );
});
