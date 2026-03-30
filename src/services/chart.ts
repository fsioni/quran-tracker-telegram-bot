// src/services/chart.ts

const QUICKCHART_BASE = "https://quickchart.io/chart";

export function computeMovingAverage(
  data: number[],
  window: number
): (number | null)[] {
  if (data.length === 0 || window <= 0) {
    return [];
  }
  return data.map((_, i) => {
    if (i < window - 1) {
      return null;
    }
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) {
      sum += data[j];
    }
    return sum / window;
  });
}

export function buildSpeedChartUrl(
  labels: string[],
  dailySpeeds: number[],
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
          spanGaps: true,
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
