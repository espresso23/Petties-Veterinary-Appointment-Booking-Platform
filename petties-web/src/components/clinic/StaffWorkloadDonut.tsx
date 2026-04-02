import { useMemo } from 'react'
import ReactApexChart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'

const STONE = '#1c1917'
const AMBER = '#d97706'
const MINT = '#0d9488'
const CORAL = '#f97316'
const BLUE = '#4299e1'

const WORKLOAD_LABELS = ['Hôm nay', 'Chờ tiếp nhận', 'Đang khám', 'Sắp tới'] as const

interface StaffWorkloadDonutProps {
    todayCount: number
    pendingCount: number
    inProgressCount: number
    upcomingCount: number
    loading?: boolean
}

/**
 * Donut from home-summary KPIs (Staff dashboard)
 */
export function StaffWorkloadDonut({
    todayCount,
    pendingCount,
    inProgressCount,
    upcomingCount,
    loading,
}: StaffWorkloadDonutProps) {
    const series = [todayCount, pendingCount, inProgressCount, upcomingCount]
    const total = todayCount + pendingCount + inProgressCount + upcomingCount

    const options: ApexOptions = useMemo(
        () => ({
            chart: {
                type: 'donut',
                toolbar: { show: false },
                foreColor: STONE,
                fontFamily: 'Inter, system-ui, sans-serif',
            },
            labels: [...WORKLOAD_LABELS],
            colors: [AMBER, MINT, CORAL, BLUE],
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
                                label: 'Tổng',
                                color: STONE,
                                formatter: () => String(total),
                            },
                        },
                    },
                },
            },
            dataLabels: { enabled: true },
            stroke: { width: 2, colors: ['#fff'] },
        }),
        [total, todayCount, pendingCount, inProgressCount, upcomingCount]
    )

    if (loading) {
        return (
            <div className="border-4 border-stone-900 bg-white p-6 shadow-brutal min-h-[280px] flex items-center justify-center text-stone-500 text-sm font-bold">
                Đang tải…
            </div>
        )
    }

    if (total === 0) {
        return (
            <div className="border-4 border-stone-900 bg-white p-6 shadow-brutal">
                <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wide mb-2">Phân bổ công việc</h3>
                <p className="text-stone-500 text-sm text-center py-8">Chưa có dữ liệu khối lượng</p>
            </div>
        )
    }

    return (
        <div className="border-4 border-stone-900 bg-white p-4 shadow-brutal">
            <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wide mb-2">Phân bổ công việc</h3>
            <ReactApexChart options={options} series={series} type="donut" height={300} />
        </div>
    )
}
