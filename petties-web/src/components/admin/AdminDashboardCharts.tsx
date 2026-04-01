import { useMemo } from 'react'
import ReactApexChart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'

export interface QueueBarItem {
    label: string
    value: number
}

interface AdminDashboardChartsProps {
    reportPending: number
    reportApproved: number
    reportRejected: number
    queueItems: QueueBarItem[]
    loading?: boolean
}

const STONE = '#1c1917'
const AMBER = '#d97706'
const MUTED = '#78716c'
const MINT = '#0d9488'
const CORAL = '#f97316'

/**
 * Report status donut + queue snapshot horizontal bar (Admin dashboard)
 */
export function AdminDashboardCharts({
    reportPending,
    reportApproved,
    reportRejected,
    queueItems,
    loading,
}: AdminDashboardChartsProps) {
    const reportTotal = reportPending + reportApproved + reportRejected

    const donutOptions: ApexOptions = useMemo(
        () => ({
            chart: {
                type: 'donut',
                toolbar: { show: false },
                foreColor: STONE,
                fontFamily: 'Inter, system-ui, sans-serif',
            },
            labels: ['Pending', 'Approved', 'Rejected'],
            colors: [AMBER, MINT, MUTED],
            legend: {
                position: 'bottom',
                labels: { colors: STONE },
            },
            plotOptions: {
                pie: {
                    donut: {
                        size: '58%',
                        labels: {
                            show: true,
                            total: {
                                show: true,
                                label: 'Total',
                                color: STONE,
                                formatter: () => String(reportTotal),
                            },
                        },
                    },
                },
            },
            dataLabels: { enabled: true },
            stroke: { width: 2, colors: ['#fff'] },
        }),
        [reportTotal]
    )

    const donutSeries = useMemo(
        () => [reportPending, reportApproved, reportRejected],
        [reportPending, reportApproved, reportRejected]
    )

    const barCategories = useMemo(() => queueItems.map((q) => q.label), [queueItems])
    const barData = useMemo(() => queueItems.map((q) => q.value), [queueItems])

    const barOptions: ApexOptions = useMemo(
        () => ({
            chart: {
                type: 'bar',
                toolbar: { show: false },
                foreColor: STONE,
                fontFamily: 'Inter, system-ui, sans-serif',
            },
            colors: [CORAL],
            plotOptions: {
                bar: {
                    horizontal: true,
                    borderRadius: 4,
                    barHeight: '72%',
                },
            },
            dataLabels: {
                enabled: true,
                formatter: (val: number) => String(val),
                style: { colors: [STONE] },
            },
            grid: { borderColor: '#e7e5e4' },
            xaxis: {
                categories: barCategories,
                labels: { style: { colors: '#57534e' } },
            },
            yaxis: {
                labels: {
                    maxWidth: 160,
                    style: { colors: '#57534e', fontSize: '11px', fontWeight: 600 },
                },
            },
            tooltip: { y: { formatter: (val: number) => String(val) } },
        }),
        [barCategories]
    )

    if (loading) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="border-4 border-stone-900 bg-white p-6 shadow-brutal min-h-[320px] flex items-center justify-center text-stone-500 text-sm font-bold">
                    Loading charts…
                </div>
                <div className="border-4 border-stone-900 bg-white p-6 shadow-brutal min-h-[320px] flex items-center justify-center text-stone-500 text-sm font-bold">
                    Loading charts…
                </div>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border-4 border-stone-900 bg-white p-4 shadow-brutal">
                <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wide mb-2 px-2">Reports by status</h3>
                {reportTotal === 0 ? (
                    <p className="text-stone-600 text-sm px-2 py-12 text-center">No report data</p>
                ) : (
                    <ReactApexChart options={donutOptions} series={donutSeries} type="donut" height={300} />
                )}
            </div>
            <div className="border-4 border-stone-900 bg-white p-4 shadow-brutal">
                <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wide mb-2 px-2">Queue snapshot</h3>
                {queueItems.every((q) => q.value === 0) ? (
                    <p className="text-stone-600 text-sm px-2 py-12 text-center">All queues empty</p>
                ) : (
                    <ReactApexChart
                        options={barOptions}
                        series={[{ name: 'Count', data: barData }]}
                        type="bar"
                        height={Math.max(280, queueItems.length * 36)}
                    />
                )}
            </div>
        </div>
    )
}
