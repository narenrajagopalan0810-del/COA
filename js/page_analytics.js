/**
 * FlynnSim - Performance Analytics & Amdahl's Law Lab (analytics.html)
 * 
 * Drives the dedicated benchmarking lab:
 * - Runs cross-architectural speedup tests
 * - Renders comparison bar charts
 * - Renders Speedup vs Core scaling curve with interactive Amdahl's Law overlay
 * - Handles CSV report generation
 */

document.addEventListener('DOMContentLoaded', () => {
    const sim = new SimulationController();
    const analytics = new AnalyticsManager(sim);

    let currentWorkloadType = 'vector_addition';
    let currentLength = 8;
    let parallelFraction = 0.85;

    const selectWorkload = document.getElementById('select-workload');
    const selectPeCount = document.getElementById('select-pe-count');
    const btnBenchmark = document.getElementById('btn-run-benchmark');
    const btnExportCSV = document.getElementById('btn-export-csv');
    const sliderAmdahl = document.getElementById('slider-amdahl-p');
    const labelAmdahl = document.getElementById('amdahl-p-value');

    function runBenchmark() {
        let wl;
        if (currentWorkloadType === 'vector_addition') {
            wl = WorkloadManager.createVectorAdditionWorkload(currentLength, sim.peCount);
        } else if (currentWorkloadType === 'matrix_mult') {
            wl = WorkloadManager.createMatrixMultiplicationWorkload(2, sim.peCount);
        } else if (currentWorkloadType === 'conditional_filter') {
            wl = WorkloadManager.createConditionalFilterWorkload(currentLength, sim.peCount);
        } else if (currentWorkloadType === 'stream_pipeline') {
            wl = WorkloadManager.createStreamPipelineWorkload(8);
        }

        sim.loadWorkload(wl);
        sim.runFastToCompletion();
        sim.setParallelFraction(parallelFraction);

        const state = sim.getAllMetrics();
        analytics.updateCharts(state);
    }

    if (btnBenchmark) {
        btnBenchmark.addEventListener('click', runBenchmark);
    }

    if (selectWorkload) {
        selectWorkload.addEventListener('change', (e) => {
            currentWorkloadType = e.target.value;
            runBenchmark();
        });
    }

    if (selectPeCount) {
        selectPeCount.addEventListener('change', (e) => {
            const count = parseInt(e.target.value, 10);
            sim.setPECount(count);
            runBenchmark();
        });
    }

    if (sliderAmdahl) {
        sliderAmdahl.addEventListener('input', (e) => {
            parallelFraction = parseFloat(e.target.value);
            sim.setParallelFraction(parallelFraction);
            if (labelAmdahl) {
                const s = 1.0 - parallelFraction;
                labelAmdahl.textContent = `Parallel: ${(parallelFraction * 100).toFixed(0)}% | Serial: ${(s * 100).toFixed(0)}%`;
            }
            analytics.updateCharts(sim.getAllMetrics());
        });
    }

    if (btnExportCSV) {
        btnExportCSV.addEventListener('click', () => {
            analytics.exportCSV(sim.getAllMetrics());
        });
    }

    // Run initial benchmark on page load
    runBenchmark();
});
