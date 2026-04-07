// src/services/chart.ts

const QUICKCHART_BASE = "https://quickchart.io/chart";

// Catppuccin Mocha palette
const TEXT = "#cdd6f4";
const SUBTEXT = "#a6adc8";
const GRID = "rgba(166,173,200,0.2)";
const BLUE = "#89b4fa";
const BLUE_FADED = "rgba(137,180,250,0.4)";
const BLUE_BG = "rgba(137,180,250,0.1)";
const GREEN = "#a6e3a1";
const GREEN_FADED = "rgba(166,227,161,0.5)";
const GREEN_BORDER = "rgba(166,227,161,0.8)";
const BACKGROUND = "%231e1e2e"; // URL-encoded #1e1e2e

export function computeMovingAverage(
  data: (number | null)[],
  window: number
): (number | null)[] {
  if (data.length === 0) {
    return [];
  }
  if (window <= 0) {
    throw new Error("window must be positive");
  }
  return data.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    let sum = 0;
    let count = 0;
    for (let j = start; j <= i; j++) {
      if (data[j] !== null) {
        sum += data[j];
        count++;
      }
    }
    return count > 0 ? sum / count : null;
  });
}

interface Dataset {
  data: (number | null)[];
  label: string;
  [key: string]: unknown;
}

function trendDataset(
  label: string,
  data: (number | null)[],
  color: string,
  type?: string
): Dataset {
  return {
    ...(type && { type }),
    label,
    data,
    borderColor: color,
    borderWidth: 3,
    pointRadius: 0,
    tension: 0.3,
    fill: false,
  };
}

function buildChartUrl(
  type: string,
  labels: string[],
  datasets: Dataset[],
  title: string,
  yAxisLabel: string
): string {
  const config = {
    type,
    data: { labels, datasets },
    options: {
      title: { display: true, text: title, fontColor: TEXT, fontSize: 16 },
      legend: { labels: { fontColor: TEXT } },
      scales: {
        xAxes: [
          {
            ticks: { fontColor: SUBTEXT },
            gridLines: { color: GRID },
          },
        ],
        yAxes: [
          {
            ticks: { fontColor: SUBTEXT, beginAtZero: true },
            gridLines: { color: GRID },
            scaleLabel: {
              display: true,
              labelString: yAxisLabel,
              fontColor: SUBTEXT,
            },
          },
        ],
      },
    },
  };

  const json = JSON.stringify(config);
  return `${QUICKCHART_BASE}?c=${encodeURIComponent(json)}&w=800&h=400&bkg=${BACKGROUND}`;
}

export function buildSpeedChartUrl(
  labels: string[],
  dailySpeeds: (number | null)[],
  movingAvg: (number | null)[],
  title: string,
  dailyLabel: string,
  trendLabel: string,
  yAxisLabel: string
): string {
  return buildChartUrl(
    "line",
    labels,
    [
      {
        label: dailyLabel,
        data: dailySpeeds,
        borderColor: BLUE_FADED,
        backgroundColor: BLUE_BG,
        borderWidth: 1,
        pointRadius: 3,
        pointBackgroundColor: BLUE_FADED,
        fill: false,
      },
      trendDataset(trendLabel, movingAvg, BLUE),
    ],
    title,
    yAxisLabel
  );
}

export function buildPagesChartUrl(
  labels: string[],
  dailyPages: (number | null)[],
  movingAvg: (number | null)[],
  title: string,
  dailyLabel: string,
  trendLabel: string,
  yAxisLabel: string
): string {
  return buildChartUrl(
    "bar",
    labels,
    [
      {
        label: dailyLabel,
        data: dailyPages,
        backgroundColor: GREEN_FADED,
        borderColor: GREEN_BORDER,
        borderWidth: 1,
      },
      trendDataset(trendLabel, movingAvg, GREEN, "line"),
    ],
    title,
    yAxisLabel
  );
}
