/**
 * FlynnSim - Performance Analytics, Charts & CSV Export Engine
 * 
 * Generates:
 * 1. Architecture Comparison Bar Charts (Cycles & Speedup)
 * 2. Speedup vs PE Count Scaling Graph with Amdahl's Law Theoretical Overlay
 * 3. Complete Telemetry & Trace CSV Exporter
 */

class AnalyticsManager {
    constructor(controller) {
        this.controller = controller;
        this.cyclesChart = null;
        this.amdahlChart = null;
    }

    /**
     * Initializes or updates both analysis charts
     */
    updateCharts(state) {
        this.updateComparisonTable(state);
        this.renderCyclesBarChart(state);
        this.renderAmdahlCurveChart(state);
    }

    /**
     * Updates the comprehensive comparison metrics table
     */
    updateComparisonTable(state) {
        const tbody = document.getElementById('comparison-table-body');
        if (!tbody) return;

        const { metrics } = state;
        const archKeys = ['SISD', 'SIMD', 'MISD', 'MIMD'];

        let rowsHTML = '';
        for (const key of archKeys) {
            const m = metrics[key];
            rowsHTML += `
            <tr>
                <td><strong>${m.name}</strong></td>
                <td>${m.peCount}</td>
                <td>${m.cycles}</td>
                <td>${m.instructions}</td>
                <td><span class="badge-speedup">${m.speedup}x</span></td>
                <td>${m.utilization}%</td>
                <td>${m.efficiency}%</td>
                <td>${m.ipc}</td>
                <td><span class="badge-status ${m.isHalted ? 'halted' : 'running'}">${m.isHalted ? 'Completed' : 'Running'}</span></td>
            </tr>
            `;
        }
        tbody.innerHTML = rowsHTML;
    }

    /**
     * Renders Bar Chart comparing Cycles and Speedup across the 4 architectures
     */
    renderCyclesBarChart(state) {
        const canvas = document.getElementById('chart-cycles-comparison');
        if (!canvas) return;

        const labels = ['SISD', 'SIMD', 'MISD', 'MIMD'];
        const cyclesData = labels.map(l => state.metrics[l].cycles);
        const speedupData = labels.map(l => state.metrics[l].speedup);

        if (typeof Chart !== 'undefined') {
            if (this.cyclesChart) {
                this.cyclesChart.data.datasets[0].data = cyclesData;
                this.cyclesChart.data.datasets[1].data = speedupData;
                this.cyclesChart.update();
            } else {
                const ctx = canvas.getContext('2d');
                this.cyclesChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [
                            {
                                label: 'Total Clock Cycles',
                                data: cyclesData,
                                backgroundColor: 'rgba(0, 255, 65, 0.85)',
                                borderColor: '#00ff41',
                                borderWidth: 1,
                                yAxisID: 'y'
                            },
                            {
                                label: 'Speedup vs SISD',
                                data: speedupData,
                                backgroundColor: 'rgba(255, 176, 0, 0.85)',
                                borderColor: '#ffb000',
                                borderWidth: 1,
                                yAxisID: 'y1'
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { labels: { color: '#00ff41', font: { family: 'JetBrains Mono', size: 11 } } },
                            tooltip: { backgroundColor: '#020603', borderColor: '#00ff41', borderWidth: 1, titleColor: '#00ff41', bodyColor: '#74ba80', titleFont: { family: 'JetBrains Mono' }, bodyFont: { family: 'JetBrains Mono' } }
                        },
                        scales: {
                            x: {
                                ticks: { color: '#74ba80', font: { family: 'JetBrains Mono' } },
                                grid: { color: '#132617' }
                            },
                            y: {
                                type: 'linear',
                                display: true,
                                position: 'left',
                                title: { display: true, text: 'Cycles', color: '#00ff41', font: { family: 'JetBrains Mono' } },
                                ticks: { color: '#74ba80', font: { family: 'JetBrains Mono' } },
                                grid: { color: '#132617' }
                            },
                            y1: {
                                type: 'linear',
                                display: true,
                                position: 'right',
                                title: { display: true, text: 'Speedup', color: '#ffb000', font: { family: 'JetBrains Mono' } },
                                ticks: { color: '#74ba80', font: { family: 'JetBrains Mono' } },
                                grid: { drawOnChartArea: false }
                            }
                        }
                    }
                });
            }
        }
    }

    /**
     * Renders Speedup vs Number of PEs with Amdahl's Law Curve Overlay
     * Speedup S(N) = 1 / ((1 - p) + (p / N))
     */
    renderAmdahlCurveChart(state) {
        const canvas = document.getElementById('chart-amdahl');
        if (!canvas) return;

        const peValues = [1, 2, 4, 8, 16];
        const p = state.parallelFraction; // e.g. 0.85
        const s = 1.0 - p;               // serial fraction e.g. 0.15

        // Calculate theoretical Amdahl's law points
        const theoreticalAmdahl = peValues.map(n => Number((1.0 / (s + (p / n))).toFixed(2)));

        // Linear Ideal Speedup S = N
        const idealSpeedup = peValues.map(n => n);

        // Empirical simulated data points for current workload
        const currentN = state.peCount;
        const simdSpeedup = state.metrics.SIMD.speedup;
        const mimdSpeedup = state.metrics.MIMD.speedup;

        const simdData = peValues.map(n => (n === currentN ? simdSpeedup : null));
        const mimdData = peValues.map(n => (n === currentN ? mimdSpeedup : null));

        if (typeof Chart !== 'undefined') {
            if (this.amdahlChart) {
                this.amdahlChart.data.datasets[0].data = theoreticalAmdahl;
                this.amdahlChart.data.datasets[0].label = `Amdahl's Law (p = ${(p * 100).toFixed(0)}%, s = ${(s * 100).toFixed(0)}%)`;
                this.amdahlChart.data.datasets[2].data = simdData;
                this.amdahlChart.data.datasets[3].data = mimdData;
                this.amdahlChart.update();
            } else {
                const ctx = canvas.getContext('2d');
                this.amdahlChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: peValues.map(n => `${n} PEs`),
                        datasets: [
                            {
                                label: `Amdahl's Law (p = ${(p * 100).toFixed(0)}%)`,
                                data: theoreticalAmdahl,
                                borderColor: '#00ff41',
                                backgroundColor: 'rgba(0, 255, 65, 0.08)',
                                borderWidth: 2,
                                fill: true,
                                tension: 0.2
                            },
                            {
                                label: 'Ideal Linear Speedup (S = N)',
                                data: idealSpeedup,
                                borderColor: '#2b5433',
                                borderDash: [4, 4],
                                borderWidth: 1,
                                fill: false
                            },
                            {
                                label: 'SIMD Empirical (Simulated)',
                                data: simdData,
                                borderColor: '#39ff14',
                                backgroundColor: '#39ff14',
                                pointRadius: 6,
                                pointHoverRadius: 8,
                                showLine: false
                            },
                            {
                                label: 'MIMD Empirical (Simulated)',
                                data: mimdData,
                                borderColor: '#ffb000',
                                backgroundColor: '#ffb000',
                                pointRadius: 6,
                                pointHoverRadius: 8,
                                showLine: false
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { labels: { color: '#00ff41', font: { family: 'JetBrains Mono', size: 11 } } },
                            tooltip: { backgroundColor: '#020603', borderColor: '#00ff41', borderWidth: 1, titleColor: '#00ff41', bodyColor: '#74ba80', titleFont: { family: 'JetBrains Mono' }, bodyFont: { family: 'JetBrains Mono' } }
                        },
                        scales: {
                            x: {
                                ticks: { color: '#74ba80', font: { family: 'JetBrains Mono' } },
                                grid: { color: '#132617' },
                                title: { display: true, text: 'Processing Elements (PEs)', color: '#74ba80', font: { family: 'JetBrains Mono' } }
                            },
                            y: {
                                ticks: { color: '#74ba80', font: { family: 'JetBrains Mono' } },
                                grid: { color: '#132617' },
                                title: { display: true, text: 'Speedup Multiplier S(N)', color: '#00ff41', font: { family: 'JetBrains Mono' } },
                                min: 0,
                                max: 16
                            }
                        }
                    }
                });
            }
        }
    }

    /**
     * Exports current simulation results and cycle log as a formatted CSV file
     */
    exportCSV(state) {
        const { metrics, workload } = state;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        let csvContent = "data:text/csv;charset=utf-8,";

        // Section 1: Metadata
        csvContent += "FLYNN SIMULATOR - PERFORMANCE EVALUATION REPORT\n";
        csvContent += `Generated At,${new Date().toLocaleString()}\n`;
        csvContent += `Workload,${workload ? workload.name : 'Unknown'}\n`;
        csvContent += `PE Count Configured,${state.peCount}\n`;
        csvContent += `Parallel Fraction (p),${state.parallelFraction}\n`;
        csvContent += `Serial Fraction (s),${(1.0 - state.parallelFraction).toFixed(2)}\n\n`;

        // Section 2: Summary Metrics
        csvContent += "Architecture,PE_Count,Total_Cycles,Instructions_Executed,Speedup_vs_SISD,PE_Utilization_Pct,Efficiency_Pct,IPC,Status\n";
        for (const key of ['SISD', 'SIMD', 'MISD', 'MIMD']) {
            const m = metrics[key];
            csvContent += `${m.name},${m.peCount},${m.cycles},${m.instructions},${m.speedup},${m.utilization}%,${m.efficiency}%,${m.ipc},${m.isHalted ? 'HALTED' : 'RUNNING'}\n`;
        }

        csvContent += "\n";

        // Section 3: Trace Logs for each architecture
        csvContent += "--- ARCHITECTURE EXECUTION TRACE LOGS ---\n";
        for (const key of ['SISD', 'SIMD', 'MISD', 'MIMD']) {
            const arch = this.controller.architectures[key];
            csvContent += `\n[${key} Trace Log (Total ${arch.traceHistory.length} Cycles)]\n`;
            arch.traceHistory.forEach(line => {
                csvContent += `"${line.replace(/"/g, '""')}"\n`;
            });
        }

        // Trigger browser download
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `FlynnSim_Results_${timestamp}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AnalyticsManager };
}
