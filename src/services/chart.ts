// src/services/chart.ts

const QUICKCHART_BASE = "https://quickchart.io/chart";

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

export function buildSpeedChartUrl(
  labels: string[],
  dailySpeeds: (number | null)[],
  movingAvg: (number | null)[],
  title: string,
  dailyLabel: string,
  trendLabel: string,
  yAxisLabel: string
): string {
  const config = {
    type: "line" as const,
    data: {
      labels,
      datasets: [
        {
          label: dailyLabel,
          data: dailySpeeds,
          borderColor: "rgba(137,180,250,0.4)",
          backgroundColor: "rgba(137,180,250,0.1)",
          borderWidth: 1,
          pointRadius: 3,
          pointBackgroundColor: "rgba(137,180,250,0.4)",
          fill: false,
        },
        {
          label: trendLabel,
          data: movingAvg,
          borderColor: "#89b4fa",
          borderWidth: 3,
          pointRadius: 0,
          tension: 0.3,
          fill: false,
        },
      ],
    },
    options: {
      title: { display: true, text: title, fontColor: "#cdd6f4", fontSize: 16 },
      legend: { labels: { fontColor: "#cdd6f4" } },
      scales: {
        xAxes: [
          {
            ticks: { fontColor: "#a6adc8" },
            gridLines: { color: "rgba(166,173,200,0.2)" },
          },
        ],
        yAxes: [
          {
            ticks: { fontColor: "#a6adc8", beginAtZero: true },
            gridLines: { color: "rgba(166,173,200,0.2)" },
            scaleLabel: {
              display: true,
              labelString: yAxisLabel,
              fontColor: "#a6adc8",
            },
          },
        ],
      },
    },
  };

  const json = JSON.stringify(config);
  return `${QUICKCHART_BASE}?c=${encodeURIComponent(json)}&w=800&h=400&bkg=%231e1e2e`;
}

export function buildPageChartUrl(
  labels: string[],
  dailyPages: (number | null)[],
  movingAvg: (number | null)[],
  title: string,
  dailyLabel: string,
  trendLabel: string
): string {
  const config = {
    type: "bar" as const,
    data: {
      labels,
      datasets: [
        {
          type: "bar" as const,
          label: dailyLabel,
          data: dailyPages,
          backgroundColor: "rgba(166,227,161,0.5)",
          borderColor: "rgba(166,227,161,0.8)",
          borderWidth: 1,
        },
        {
          type: "line" as const,
          label: trendLabel,
          data: movingAvg,
          borderColor: "#a6e3a1",
          borderWidth: 3,
          pointRadius: 0,
          tension: 0.3,
          fill: false,
        },
      ],
    },
    options: {
      title: { display: true, text: title, fontColor: "#cdd6f4", fontSize: 16 },
      legend: { labels: { fontColor: "#cdd6f4" } },
      scales: {
        xAxes: [
          {
            ticks: { fontColor: "#a6adc8" },
            gridLines: { color: "rgba(166,173,200,0.2)" },
          },
        ],
        yAxes: [
          {
            ticks: { fontColor: "#a6adc8", beginAtZero: true },
            gridLines: { color: "rgba(166,173,200,0.2)" },
          },
        ],
      },
    },
  };

  const json = JSON.stringify(config);
  return `${QUICKCHART_BASE}?c=${encodeURIComponent(json)}&w=800&h=400&bkg=%231e1e2e`;
}
