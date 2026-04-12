import { useMemo } from 'react'
import ReactApexChart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'
import { formatVnd } from '../../utils/formatCurrency'

const STONE = '#1c1917'
const AMBER = '#d97706'
const MINT = '#0d9488'
const CORAL = '#f97316'
const BLUE = '#4299e1'
const YELLOW = '#fbbf24'
const MUTED = '#78716c'

const DONUT_COLORS = [AMBER, MINT, CORAL, BLUE, YELLOW, MUTED, '#a855f7', '#14b8a6']

export interface BookingStatusSegment {
    name: string
    value: number
}

interface ClinicDashboardChartsProps {
    revenueLabels: string[]
    /** Số hoặc chuỗi số từ API — component sẽ ép kiểu trước khi đưa vào ApexCharts */
    revenueValues: Array<number | string>
    revenueTitle?: string
    bookingSegments: BookingStatusSegment[]
    loading?: boolean
}

/**
 * Revenue bar + booking status donut (Clinic Owner / Manager dashboards)
 */
export function ClinicDashboardCharts({
    revenueLabels,
    revenueValues,
    revenueTitle = 'Doanh thu (tuần)',
    bookingSegments,
    loading,
}: ClinicDashboardChartsProps) {
    /** API có thể trả total dạng string (BigDecimal JSON) — Apex cần số thuần để vẽ cột */
    const revenueSeriesNumbers = useMemo(
        () => revenueValues.map((v) => (typeof v === 'number' && !Number.isNaN(v) ? v : Number(v) || 0)),
        [revenueValues]
    )

    const revenueTotal = useMemo(
        () => revenueSeriesNumbers.reduce((s, v) => s + v, 0),
        [revenueSeriesNumbers]
    )

    /** Cắt cùng độ dài tránh lệch label/value làm Apex không vẽ */
    const { revenueLabelsAligned, revenueValuesAligned } = useMemo(() => {
        const n = Math.min(revenueLabels.length, revenueSeriesNumbers.length)
        return {
            revenueLabelsAligned: revenueLabels.slice(0, n),
            revenueValuesAligned: revenueSeriesNumbers.slice(0, n),
        }
    }, [revenueLabels, revenueSeriesNumbers])

    const hasRevenueBars = useMemo(
        () => revenueValuesAligned.length > 0 && revenueValuesAligned.some((v) => v > 0),
        [revenueValuesAligned]
    )

    const barOptions: ApexOptions = useMemo(
        () => ({
            chart: {
                type: 'bar',
                toolbar: { show: false },
                foreColor: STONE,
                fontFamily: 'Inter, system-ui, sans-serif',
                redrawOnParentResize: true,
                redrawOnWindowResize: true,
            },
            colors: [AMBER],
            plotOptions: {
                bar: {
                    columnWidth: '62%',
                    borderRadius: 4,
                },
            },
            dataLabels: {
                enabled: true,
                formatter: (val: number) => formatVnd(val),
                style: { colors: [STONE], fontSize: '10px', fontWeight: 600 },
            },
            grid: { borderColor: '#e7e5e4' },
            xaxis: {
                categories: revenueLabelsAligned,
                labels: { style: { colors: '#57534e', fontSize: '11px', fontWeight: 600 } },
            },
            yaxis: {
                min: 0,
                labels: {
                    formatter: (val: number) => formatVnd(val),
                    style: { colors: '#57534e', fontSize: '11px' },
                },
            },
            tooltip: {
                y: { formatter: (val: number) => formatVnd(val) },
            },
        }),
        [revenueLabelsAligned]
    )

    const barSeries = useMemo(
        () => [{ name: 'Doanh thu', data: revenueValuesAligned }],
        [revenueValuesAligned]
    )

    const nonZeroSegments = useMemo(
        () => bookingSegments.filter((s) => s.value > 0),
        [bookingSegments]
    )
    const donutTotal = useMemo(() => nonZeroSegments.reduce((s, x) => s + x.value, 0), [nonZeroSegments])

    const donutOptions: ApexOptions = useMemo(
        () => ({
            chart: {
                type: 'donut',
                toolbar: { show: false },
                foreColor: STONE,
                fontFamily: 'Inter, system-ui, sans-serif',
            },
            labels: nonZeroSegments.map((s) => s.name),
            colors: DONUT_COLORS.slice(0, Math.max(nonZeroSegments.length, 1)),
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
                                label: 'Lịch hẹn',
                                color: STONE,
                                formatter: () => String(donutTotal),
                            },
                        },
                    },
                },
            },
            dataLabels: { enabled: true },
            stroke: { width: 2, colors: ['#fff'] },
        }),
        [nonZeroSegments, donutTotal]
    )

    const donutSeries = useMemo(() => nonZeroSegments.map((s) => s.value), [nonZeroSegments])

    if (loading) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="border-4 border-stone-900 bg-white p-6 shadow-brutal min-h-[320px] flex items-center justify-center text-stone-500 text-sm font-bold">
                    Đang tải biểu đồ…
                </div>
                <div className="border-4 border-stone-900 bg-white p-6 shadow-brutal min-h-[320px] flex items-center justify-center text-stone-500 text-sm font-bold">
                    Đang tải biểu đồ…
                </div>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border-4 border-stone-900 bg-white p-4 shadow-brutal">
                <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wide mb-2">{revenueTitle}</h3>
                <p className="text-xs text-stone-500 mb-2">Tổng: {formatVnd(revenueTotal)}</p>
                {!hasRevenueBars ? (
                    <p className="text-stone-500 text-sm py-12 text-center">Chưa có doanh thu trong kỳ này</p>
                ) : (
                    <div className="min-h-[280px] w-full">
                        <ReactApexChart
                            key={`rev-${revenueLabelsAligned.join('|')}-${revenueValuesAligned.join(',')}`}
                            options={barOptions}
                            series={barSeries}
                            type="bar"
                            height={280}
                            width="100%"
                        />
                    </div>
                )}
            </div>

            <div className="border-4 border-stone-900 bg-white p-4 shadow-brutal">
                <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wide mb-2">Lịch hẹn theo trạng thái</h3>
                {nonZeroSegments.length === 0 ? (
                    <p className="text-stone-500 text-sm py-12 text-center">Chưa có lịch trong mẫu dữ liệu</p>
                ) : (
                    <ReactApexChart options={donutOptions} series={donutSeries} type="donut" height={320} />
                )}
            </div>
        </div>
    )
}
