// tests/services/chart.test.ts
import { describe, expect, it } from "vitest";
import {
  buildSpeedChartUrl,
  computeMovingAverage,
} from "../../src/services/chart";

describe("computeMovingAverage", () => {
  it("computes SMA correctly with full window", () => {
    const data = [2, 4, 6, 8, 10];
    const result = computeMovingAverage(data, 3);
    // First two use expanding window, rest use full window
    expect(result).toEqual([2, 3, 4, 6, 8]);
  });

  it("uses expanding window when window > data length", () => {
    const result = computeMovingAverage([1, 2], 5);
    expect(result).toEqual([1, 1.5]);
  });

  it("returns empty array for empty input", () => {
    expect(computeMovingAverage([], 3)).toEqual([]);
  });

  it("window of 1 returns the data itself", () => {
    const data = [5, 10, 15];
    const result = computeMovingAverage(data, 1);
    expect(result).toEqual([5, 10, 15]);
  });
});

const QUICKCHART_RE = /^https:\/\/quickchart\.io\/chart\?c=/;

describe("buildSpeedChartUrl", () => {
  const labels = ["01/03", "02/03", "03/03"];
  const speeds = [10, 12, 14];
  const movingAvg = [10, 11, 12];

  it("starts with quickchart.io base URL", () => {
    const url = buildSpeedChartUrl(
      labels,
      speeds,
      movingAvg,
      "Test Title",
      "Daily",
      "Trend",
      "pages/h"
    );
    expect(url).toMatch(QUICKCHART_RE);
  });

  it("includes width and height params", () => {
    const url = buildSpeedChartUrl(
      labels,
      speeds,
      movingAvg,
      "Test",
      "Daily",
      "Trend",
      "pages/h"
    );
    expect(url).toContain("w=800");
    expect(url).toContain("h=400");
  });

  it("contains valid Chart.js config when decoded", () => {
    const url = buildSpeedChartUrl(
      labels,
      speeds,
      movingAvg,
      "Test Title",
      "Daily",
      "Trend",
      "pages/h"
    );
    const cParam = new URL(url).searchParams.get("c");
    expect(cParam).toBeTruthy();
    const config = JSON.parse(cParam as string);
    expect(config.type).toBe("line");
    expect(config.data.labels).toEqual(labels);
    expect(config.data.datasets).toHaveLength(2);
    expect(config.data.datasets[0].label).toBe("Daily");
    expect(config.data.datasets[0].data).toEqual(speeds);
    expect(config.data.datasets[1].label).toBe("Trend");
    expect(config.data.datasets[1].data).toEqual(movingAvg);
  });

  it("includes dark background param", () => {
    const url = buildSpeedChartUrl(
      labels,
      speeds,
      movingAvg,
      "Test",
      "D",
      "T",
      "pages/h"
    );
    expect(url).toContain("bkg=%231e1e2e");
  });
});
