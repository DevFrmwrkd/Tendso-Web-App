"use client"

import { CategoryScale, Chart as ChartJS, LinearScale, LineElement, PointElement, Tooltip, type ChartOptions, type Plugin } from "chart.js"
import { useMemo, useState } from "react"
import { Line } from "react-chartjs-2"

import { formatMoney } from "@/components/r1"

// No Filler (no area under the line) and no Legend (one series: the heading
// names it). Registered here, so chart.js is only fetched when the money fold
// opens: MoneyFold loads this file with next/dynamic.
ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip)

export type ChartPoint = { label: string; long: string; amount: number }

/**
 * The Round 1 tokens as the canvas needs them. A canvas cannot read CSS
 * variables, so they are resolved once, here, from app/round1.css: no colour
 * is written twice, and a token change reaches the chart too.
 */
function readTokens() {
    const css = getComputedStyle(document.documentElement)
    const token = (name: string) => css.getPropertyValue(name).trim()
    return {
        ink: token("--r1-ink"),
        ink3: token("--r1-ink-3"),
        line: token("--r1-line"),
        line2: token("--r1-line-2"),
        line3: token("--r1-line-3"),
        paper: token("--r1-paper"),
        sans: token("--r1-sans"),
    }
}

/** The crosshair: a hairline at the hovered month, so the reader aims at a month, not at a 2px line. */
function crosshair(color: string): Plugin<"line"> {
    return {
        id: "r1-crosshair",
        beforeDatasetsDraw(chart) {
            const active = chart.getActiveElements()
            if (active.length === 0) return
            const x = active[0].element.x
            const { top, bottom } = chart.chartArea
            const ctx = chart.ctx
            ctx.save()
            ctx.beginPath()
            ctx.moveTo(x, top)
            ctx.lineTo(x, bottom)
            ctx.lineWidth = 1
            ctx.strokeStyle = color
            ctx.stroke()
            ctx.restore()
        },
    }
}

/**
 * Gross earnings by month: the old dashboard's revenue chart, moved into the
 * money fold on Payouts and redrawn in the Round 1 look. One 2px ink line, no
 * fill, no gradient, no curve smoothing (a smoothed line invents values
 * between the months); hairline grid in the line token; values in ₱ with no
 * space. The tooltip leads with the value, then the month.
 */
export default function RevenueChart({ points, label }: { points: ChartPoint[]; label: string }) {
    // Client-only (loaded with ssr: false), so the document is there to read.
    const [t] = useState(readTokens)
    const plugins = useMemo(() => [crosshair(t.line2)], [t.line2])

    const data = useMemo(
        () => ({
            labels: points.map((p) => p.label),
            datasets: [
                {
                    label,
                    data: points.map((p) => p.amount),
                    borderColor: t.ink,
                    backgroundColor: t.ink,
                    borderWidth: 2,
                    borderJoinStyle: "round" as const,
                    borderCapStyle: "round" as const,
                    tension: 0,
                    // A lone month has no line to draw, so it shows its dot.
                    pointRadius: points.length === 1 ? 4 : 0,
                    pointHoverRadius: 4,
                    pointHitRadius: 12,
                    pointBackgroundColor: t.ink,
                    pointBorderColor: t.paper,
                    pointBorderWidth: 2,
                    pointHoverBorderWidth: 2,
                },
            ],
        }),
        [points, label, t],
    )

    const options = useMemo<ChartOptions<"line">>(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { mode: "index", intersect: false },
            layout: { padding: { top: 8, right: 8 } },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: t.paper,
                    borderColor: t.line,
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 10,
                    caretSize: 0,
                    displayColors: false,
                    titleColor: t.ink,
                    titleFont: { family: t.sans, size: 14, weight: 600 },
                    titleMarginBottom: 2,
                    bodyColor: t.ink3,
                    bodyFont: { family: t.sans, size: 12 },
                    callbacks: {
                        title: (items) => formatMoney(points[items[0]?.dataIndex ?? 0]?.amount ?? 0),
                        label: (item) => points[item.dataIndex]?.long ?? "",
                    },
                },
            },
            scales: {
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: { color: t.ink3, font: { family: t.sans, size: 12 }, maxRotation: 0, autoSkipPadding: 16 },
                },
                y: {
                    beginAtZero: true,
                    grid: { color: t.line3, lineWidth: 1, drawTicks: false },
                    border: { display: false },
                    ticks: {
                        color: t.ink3,
                        font: { family: t.sans, size: 12 },
                        padding: 8,
                        maxTicksLimit: 5,
                        precision: 0,
                        callback: (value) => formatMoney(Number(value)),
                    },
                },
            },
        }),
        [points, t],
    )

    const high = points.reduce<ChartPoint | null>((best, p) => (best === null || p.amount > best.amount ? p : best), null)
    const summary =
        points.length === 0
            ? `${label}: no data yet.`
            : `${label}, ${points[0].long} to ${points[points.length - 1].long}.${high && high.amount > 0 ? ` Highest: ${formatMoney(high.amount)} in ${high.long}.` : ""} The same figures are in the table view.`

    return (
        // Fixed height INCLUDING the axis labels (chart.js draws them inside the canvas).
        <div className="relative h-64 w-full">
            <Line data={data} options={options} plugins={plugins} aria-label={summary} />
        </div>
    )
}
